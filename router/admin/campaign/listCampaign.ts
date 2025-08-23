import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * List all campaign from an area
 *
 * @example
 * body:{
 *	"adminCode": string,
 *	"area": mongoDBID,
 *	"skip": number,
 *	"limit": number,
 * 	"allreadyHashed": boolean
 * }
 *
 * @throws {400} - Missing parameters
 * @throws {400} - bad hash for admin code
 * @throws {401} - Wrong admin code
 * @throws {200} - OK
 */

export default async function listCampaign(req: Request<any>, res: Response<any>) {
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
				['skip', 'number', true],
				['limit', 'number', true],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;
	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } }, ['name']);
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	const numberOfCampaign = await Campaign.countDocuments({ area: area._id });
	const campaigns = await Campaign.find({ area: area._id }, [
		'_id',
		'name',
		'active',
		'callHours',
		'timeBetweenCall',
		'numberMaxCall'
	])
		.skip(req.body.skip ? req.body.skip : 0)
		.limit(req.body.limit ? req.body.limit : 50);
	if (!campaigns || campaigns.length === 0) {
		res.status(404).send({ message: 'No campaign found', OK: false });
		log(`[${req.body.area}, ${ip}] No campaign found`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({
		message: 'OK',
		OK: true,
		data: { campaigns: campaigns, numberOfCampaign: numberOfCampaign }
	});
	log(`[${req.body.area}, ${ip}] list campaign`, 'INFO', __filename);
}
