import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * Get stats of call by date
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
 * @throws {401} Wrong admin code
 * @throws {401} Wrong campaign id
 * @throws {200} OK
 */
export default async function callByDate(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	if (
		!checkParameters(
			req.body,
			res,
			[
				['CampaignId', 'string', true],
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
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } }, ['name']);
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}
	let campaign: InstanceType<typeof Campaign> | null = null;

	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id }, []);
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true }, []);
	}
	if (!campaign) {
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Transfer-Encoding', 'chunked');
	res.write('{ "data": [');

	const NbCall = await Call.countDocuments({
		campaign: campaign._id,
		satisfaction: {
			$not: { $regex: /^\[hide\]/ }
		},
		$expr: { $ne: ['$satisfaction', null] }
	});

	await Call.find({
		campaign: campaign._id,
		satisfaction: {
			$not: { $regex: /^\[hide\]/ }
		},
		$expr: { $ne: ['$satisfaction', null] }
	})
		.cursor()
		.eachAsync((call, i) => {
			res.write(
				JSON.stringify({
					date: call.start ?? 0,
					response: call.status,
					satisfaction: call.satisfaction
				}) + (NbCall - 1 == i ? '' : ',')
			);
		});
	res.write(']}');
	res.end();
	log(`[${req.body.area}, ${ip}] get call by date`, 'INFO', __filename);
}
