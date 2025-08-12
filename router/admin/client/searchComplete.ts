import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, partialSearchClient } from '../../../tools/utils';

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

	const result = await partialSearchClient(
		campaign,
		req.body.name,
		req.body.firstName,
		req.body.phoneFragmentStart,
		req.body.phoneFragmentEnd
	);

	res.status(result.OK ? 200 : 404).send(result);
	log(
		`[${req.body.area}, ${ip}] ${result.OK ? 'no clients found on second pass' : 'client found'}`,
		'INFO',
		__filename
	);
}
