import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { ObjectId } from 'mongodb';
import { Caller } from '../../../Models/Caller';
import { checkParameters, hashPasword } from '../../../tools/utils';
/**
 * Get stats of call
 *
 * @example
 * body: {
 * 	CampaignId: ObjectId,
 * 	adminCode: String,
 * 	area: ObjectId,
 * 	"allreadyHashed": boolean
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong Creantial
 * @throws {401} Wrong campaign id
 * @throws {200} OK
 */
export default async function numberOfCallers(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	if (
		!checkParameters(
			req.body,
			res,
			[
				['campaign', 'string', true],
				['adminCode', 'string'],
				['area', 'ObjectId'],
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
		res.status(401).send({ message: 'Wrong Creantial', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong Creantial`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null = null;
	if (req.body.campaign) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.campaign }, area: area._id });
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true });
	}
	if (!campaign) {
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}

	const countCallers = await Caller.countDocuments({ $or: [{ campaigns: campaign._id }, { area: area.id }] });

	res.status(200).send({
		message: 'in this campaign ' + countCallers + ' caller was added',
		OK: true,
		data: { numberOfCallers: countCallers }
	});
	log(`[${req.body.area}, ${ip}] number of caller get`, 'INFO', __filename);
}
