import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * set active campaign
 *
 * @example
 * body:
 * {
 * 	"adminCode": string,
 * 	"active": boolean,
 * 	"campaign": string,
 * 	"area": string,
 * 	"allreadyHashed": boolean
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong admin code
 * @throws {404} Campaign not found
 * @throws {200} Campaign activated
 * @throws {200} Campaign deactivated
 */
export default async function setActive(req: Request<any>, res: Response<any>) {
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
				['active', 'boolean'],
				['campaign', 'string', true],
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

	//unacactive actual campaign
	if (req.body.campaign) {
		await Campaign.updateOne({ _id: { $eq: req.body.campaign }, area: area._id }, { active: false });
	} else {
		await Campaign.updateOne({ area: area._id, active: true }, { active: false });
	}
	//active new campaign
	if (req.body.active) {
		const campaign = await Campaign.updateOne(
			{
				_id: { $eq: req.body.campaign },
				area: area._id
			},
			{ active: true }
		);
		if (campaign.matchedCount != 1) {
			res.status(404).send({ message: 'Campaign not found', OK: false });
			log(`[${req.body.area}, ${ip}] Campaign not found`, 'WARNING', __filename);
			return;
		}
	}

	if ((await Campaign.countDocuments({ area: area._id, active: true })) > 1) {
		await Campaign.updateOne({ area: area._id, active: true }, { active: false });
		res.status(500).send({ message: 'Multiple active campaign', OK: false });
		log(`[${req.body.area}, ${ip}] Multiple active campaign`, 'WARNING', __filename);
		return;
	}

	if (req.body.active) {
		res.status(200).send({ message: 'Campaign activated', OK: true });
		log(`[${req.body.area}, ${ip}] Campaign activated`, 'INFO', __filename);
		return;
	} else {
		res.status(200).send({ message: 'Campaign desactivated', OK: true });
		log(`[${req.body.area}, ${ip}] Campaign desactivated`, 'INFO', __filename);
	}
}
