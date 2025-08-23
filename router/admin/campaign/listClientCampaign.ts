import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * List all clients from a campaign
 *
 * @example
 * body:{
 *	adminCode: string,
 *	CampaignId?: string,
 *	skip?: number,
 *	limit?: number,
 *	area: string,
 * 	"allreadyHashed": boolean
 * }
 *
 *	@throws {400} - Missing parameters
 * @throws {400} - bad hash for admin code
 *	@throws {401} - Wrong admin code
 *	@throws {401} - Wrong campaign id
 *	@throws {401} - No clients found
 *	@throws {200} - OK
 */

export default async function listClientCampaign(req: Request<any>, res: Response<any>) {
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
				['CampaignId', 'string', true],
				['skip', 'number', true],
				['limit', 'number', true],
				['area', 'ObjectId'],
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
		res.status(404).send({ message: 'Wrong campaign id', OK: false });
		log(`[${ip}, ${req.body.area}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}

	const numberOfClients = await Client.countDocuments({ campaigns: campaign._id });
	const clients = await Client.find({ campaigns: campaign._id })
		.skip(req.body.skip ? req.body.skip : 0)
		.limit(req.body.limit ? req.body.limit : 50);
	if (!clients || clients.length === 0) {
		res.status(401).send({ message: 'No clients found', OK: false });
		log(`[${ip}, ${req.body.area}] No clients found`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ message: 'OK', OK: true, data: { clients: clients, numberOfClients: numberOfClients } });
	log(`[${ip}, ${req.body.area}] client list campaign send`, 'INFO', __filename);
}
