import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * Change the call hours of a campaign
 *
 * @example
 * body:{
 * 	"adminCode": string,
 * 	"newEndHours": string,
 * 	"newStartHours": string,
 * 	"area": mongoDBID,
 * 	"CampaignId": mongoDBID,
 *	"allreadyHased": boolean
 * }
 *
 * @throws {400} - Missing parameters
 * @throws {400} - bad hash for admin code
 * @throws {400} - Campaign not found
 * @throws {400} - Invalid end date
 * @throws {400} - Invalid start date
 * @throws {401} - Wrong admin code
 * @throws {401} - Wrong campaign id
 * @throws {200} - OK
 */
export default async function changeCallHours(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	if (
		!checkParameters(
			req.body,
			res,
			[
				['adminCode', 'string'],
				['newEndHours', 'string'],
				['newStartHours', 'string'],
				['area', 'ObjectId'],
				['CampaignId', 'string', true],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } });
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null = null;

	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id });
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true });
	}
	if (!campaign) {
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${ip}, ${req.body.area}] Wrong campaign id from ${area.name} (${ip})`, 'WARNING', __filename);
		return;
	}

	const dateEnd = Date.parse(req.body.newEndHours);
	if (!dateEnd) {
		res.status(400).send({ message: 'Invalid end date', OK: false });
		log(`[${ip}, ${req.body.area}] Invalid end date`, 'WARNING', __filename);
		return;
	}
	const dateStart = Date.parse(req.body.newStartHours);
	if (!dateStart) {
		res.status(400).send({ message: 'Invalid start date', OK: false });
		log(`[${ip}, ${req.body.area}] Invalid start date`, 'WARNING', __filename);
		return;
	}

	const output = await Campaign.updateOne(
		{ _id: campaign._id },
		{ callHoursEnd: dateEnd, callHoursStart: dateStart }
	);
	if (output.matchedCount != 1) {
		res.status(400).send({ message: 'Campaign not found', OK: false });
		log(`[${ip}, ${req.body.area}] Campaign not found`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ message: 'OK', OK: true });
	log(`[${ip}, ${req.body.area}] Campaign hours changed`, 'INFO', __filename);
}
