import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';

import { Area } from '../../Models/Area';
import { log } from '../../tools/log';
import { Campaign } from '../../Models/Campaign';
import { checkParameters, hashPasword } from '../../tools/utils';

/**
 * Check if the admin code is correct and return the area name and the actual campaign
 * @example
 *
 * body: {
 * 	adminCode: 'adminCode',
 * 	area: 'areaId'
 * 	allreadyHashed: boolean
 * }
 *
 * response: {
 * 	message: 'OK',
 * 	data: {
 * 		areaName: 'areaName',
 * 		actualCampaignId: 'campaignId',
 * 		actualCampaignName: 'campaignName',
 * 		actualCampaignCallStart: 'HH:MM',
 * 		actualCampaignCallEnd: 'HH:MM',
 * 		actualCampaignMaxCall: 10,
 * 		actualCampaignScript: 'script',
 * 		actualCampaignTimeBetweenCall: 10
 * 	},
 * 	OK: true
 * }
 *
 * @throws {400} - Missing parameters
 * @throws {400} - password is not a hash
 * @throws {401} - Wrong admin code
 * @throws {500} - Internal error
 */
export default async function login(req: Request<any>, res: Response<any>) {
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
				['allreadyHashed', 'boolean', true]
			],
			'login.ts'
		)
	)
		return;

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: password });
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', 'login.ts');
		return;
	}

	let campaign = await Campaign.findOne({ area: area._id, active: true });

	res.status(200).send({
		message: 'OK',
		data: {
			areaName: area.name,
			actualCampaignId: campaign?._id ?? undefined,
			actualCampaignName: campaign?.name ?? undefined,
			actualCampaignCallStart: campaign?.callHoursStart ?? undefined,
			actualCampaignCallEnd: campaign?.callHoursEnd ?? undefined,
			actualCampaignMaxCall: campaign?.nbMaxCallCampaign ?? undefined,
			actualCampaignScript: campaign?.script ?? undefined,
			actualCampaignStatus: campaign?.status ?? undefined,
			actualCampaignTimeBetweenCall: campaign?.timeBetweenCall ?? undefined,
			actualCampaignCallPermited: campaign?.callPermited ?? undefined
		},
		OK: true
	});
	log(`[${req.body.area}, ${ip}] Login`, 'INFO', 'login.ts');
}
