import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword } from '../../../tools/utils';

/**
 * Search for clients by phone
 *
 * @example
 * body: {
 * 	phone: String,
 * 	adminCode: String,
 * 	area: ObjectId,
 *	"allreadyHased": boolean
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong admin code
 * @throws {200} OK
 */
export default async function SearchByPhone(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	if (
		!checkParameters(
			req.body,
			res,
			[
				['phone', 'string'],
				['adminCode', 'string'],
				['area', 'ObjectId'],
				['allreadyHaseded', 'boolean', true]
			],
			__filename
		)
	)
		return;
	const password = hashPasword(req.body.adminCode, req.body.allreadyHaseded, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } });
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null;
	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id });
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true });
	}

	req.body.phone = clearPhone(req.body.phone);
	req.body.phone = req.body.phone.match(/\d+/g)?.join('') || '';

	const output = await Client.find({ phone: { $regex: req.body.phone, $options: 'i' }, campaigns: campaign }, [
		'name',
		'phone',
		'firstname'
	]).limit(10);
	res.status(200).send({ message: 'OK', OK: true, data: output });
	log(`[${req.body.area}, ${ip}] Clients searched`, 'INFO', __filename);
}
