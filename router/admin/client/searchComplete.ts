import { Request, Response } from 'express';
import stringSimilarity from 'string-similarity';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * Search for clients with name, fist name and patial phone
 * @readMe if you have an partial phone use'it, this greatly reduces complexity
 *
 * @example
 * body: {
 * 	name: String,
 * 	firstName: String,
 * 	phoneFragmentStart: String,
 * 	phoneFragmentEnd: String,
 * 	adminCode: String,
 * 	area: ObjectId,
 * 	allreadyHased: boolean
 * 	CampaignId?: ObjectId
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong admin code
 * @throws {200} OK
 */
export default async function searchComplete(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	if (
		!checkParameters(
			req.body,
			res,
			[
				['name', 'string'],
				['firstName', 'string'],
				['phoneFragmentStart', 'string', true],
				['phoneFragmentEnd', 'string', true],
				['adminCode', 'string'],
				['area', 'ObjectId'],
				['CampaignId', 'string', true],
				['allreadyHaseded', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const password = hashPasword(req.body.adminCode, req.body.allreadyHaseded, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } }, ['_id']);
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null;
	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id }, ['_id']);
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true }, ['_id']);
	}

	// Use fuzzy search in MongoDB with regex for partial and case-insensitive matching
	const searchName = req.body.name?.trim();
	const searchFirstName = req.body.firstName?.trim();
	let phoneStart = req.body.phoneFragmentStart?.trim();
	let phoneEnd = req.body.phoneFragmentEnd?.trim();

	const query: any = { campaigns: campaign };

	function escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	phoneStart = phoneStart ? escapeRegex(phoneStart) : '';
	phoneEnd = phoneEnd ? escapeRegex(phoneEnd) : '';

	if (phoneStart && phoneEnd) {
		query.phone = { $regex: new RegExp(`^\\+?${phoneStart}\\d*${phoneEnd}$`, 'i') };
	} else if (phoneStart) {
		query.phone = { $regex: new RegExp(`^\\+?${phoneStart}\\d*`, 'i') };
	} else if (phoneEnd) {
		query.phone = { $regex: new RegExp(`+\\d*${phoneEnd}$`, 'i') };
	}

	const fistPassQuery = { ...query };
	if (searchName) {
		fistPassQuery.name = { $regex: new RegExp(`^${searchName}$`, 'i') };
	}
	if (searchFirstName) {
		fistPassQuery.firstname = { $regex: new RegExp(`^${searchFirstName}$`, 'i') };
	}

	const clients = await Client.find(fistPassQuery, ['name', 'phone', 'firstname']).limit(1);

	if (!clients || clients.length != 1) {
		await searchWithCursor();
		return;
	} else {
		res.status(200).send({ message: 'found on first pass', OK: true, data: clients[0] });
		log(`[${req.body.area}, ${ip}] Clients found on first pass`, 'INFO', __filename);
	}
	// =========== deep search =========== \\
	async function searchWithCursor() {
		const cursor = Client.find(query, ['name', 'firstname', 'phone']).cursor();

		let bestMatch: any = null;
		let bestScore = 0;

		for await (const client of cursor) {
			let score = 0;
			if (searchName && client.name) {
				score += stringSimilarity.compareTwoStrings(searchName.toLowerCase(), client.name.toLowerCase());
			}
			if (searchFirstName && client.firstname) {
				score += stringSimilarity.compareTwoStrings(
					searchFirstName.toLowerCase(),
					client.firstname.toLowerCase()
				);
			}

			if (score > bestScore) {
				bestScore = score;
				bestMatch = client;
			}

			if (score >= 1.8) break;
		}

		if (bestMatch && bestScore >= 0.5) {
			res.status(200).send({ message: 'found on second pass', OK: true, data: bestMatch });
			log(`[${req.body.area}, ${ip}] Clients found on second pass`, 'INFO', __filename);
			return;
		} else {
			res.status(404).send({ message: 'no client found', OK: false });
			log(`[${req.body.area}, ${ip}] no clients found on second pass`, 'INFO', __filename);
			return;
		}
	}
}
