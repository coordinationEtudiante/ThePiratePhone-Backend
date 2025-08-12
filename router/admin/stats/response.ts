import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

export default async function response(req: Request<any>, res: Response<any>) {
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
				['allreadyHaseded', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const password = hashPasword(req.body.adminCode, req.body.allreadyHaseded, res);
	if (!password) return;
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } }, ['name']);
	if (!area) {
		res.status(401).send({ message: 'Wrong Credentials', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong Creantial`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null = null;
	if (!req.body.CampaignId) campaign = await Campaign.findOne({ area: area.id, active: true }, ['status']);
	else campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area.id }, ['status']);

	if (!campaign || campaign == null) {
		res.status(404).send({ message: 'no campaign in progress or campaign not found', OK: false });
		log(`[${req.body.area}, ${ip}] No campaign in progress or campaign not found`, 'WARNING', __filename);
		return;
	}

	let clientCalled = await Call.countDocuments({ campaign: campaign._id });

	let callStatus = campaign.status
		.filter(e => !e.name?.startsWith('[hide]'))
		.map(async status => {
			return {
				name: status.name,
				count: (
					(await Call.aggregate([
						{
							$match: {
								campaign: campaign._id
							}
						},
						{ $sort: { start: -1 } },
						{
							$group: {
								_id: '$client',
								satisfaction: { $first: '$satisfaction' }
							}
						},
						{
							$match: {
								satisfaction: status.name
							}
						}
					])) as any
				).length
			};
		});
	res.status(200).send({
		message: 'OK',
		OK: true,
		data: {
			clientCalled,
			callStatus: await Promise.all(callStatus)
		}
	});

	log(`[${req.body.area}, ${ip}] response stats get`, 'INFO', __filename);
}
