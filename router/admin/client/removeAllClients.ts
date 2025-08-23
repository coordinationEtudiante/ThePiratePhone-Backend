import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * remove all clients from a campaign
 *
 * @example
 * body: {
 * 	adminCode: string,
 * 	area: string,
 * 	CampaignId?: string,
 *	"allreadyHased": boolean
 * }
 *
 * @throws {400} if missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} if wrong admin code
 * @throws {401} if wrong campaign id
 * @throws {500} if error removing clients
 * @throws {200} if OK
 */
export default async function removeAllClients(req: Request<any>, res: Response<any>) {
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
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } });
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
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}

	// find all call in progress (with client) in the campaign
	const calls = await Call.deleteMany({
		campaigns: campaign._id
	});
	if (!calls) {
		res.status(500).send({ message: 'Error removing clients', OK: false });
		log(`[${req.body.area}, ${ip}] Error removing clients`, 'ERROR', __filename);
		return;
	}

	// remove all clients in the campaign
	const clients = await Client.deleteMany({
		campaigns: campaign._id
	});

	if (!clients) {
		res.status(500).send({ message: 'Error removing clients', OK: false });
		log(`[${req.body.area}, ${ip}] Error removing clients`, 'ERROR', __filename);
		return;
	}

	res.status(200).send({ message: 'OK', OK: true });
	log(`[${req.body.area}, ${ip}] Clients removed`, 'INFO', __filename);
}
