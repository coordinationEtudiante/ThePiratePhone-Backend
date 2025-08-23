import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword } from '../../../tools/utils';

/**
 * Get stats of call
 *
 * @example
 * body: {
 * 	CampaignId: ObjectId,
 * 	adminCode: String,
 * 	area: ObjectId,
 *	"allreadyHashed": boolean
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong Creantial
 * @throws {404} no campaign in progress or campaign not found
 * @throws {200} OK
 */
export default async function call(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';

	if (
		!checkParameters(
			req.body,
			res,
			[
				['CampaignId', 'ObjectId', true],
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
	if (!req.body.CampaignId) campaign = await Campaign.findOne({ area: area.id, active: true });
	else campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area.id });

	if (!campaign || campaign == null) {
		res.status(404).send({ message: 'no campaign in progress or campaign not found', OK: false });
		log(`[${req.body.area}, ${ip}] No campaign in progress or campaign not found`, 'WARNING', __filename);
		return;
	}

	const result = await Call.aggregate([
		{
			$match: {
				campaign: campaign._id
			}
		},
		{
			$facet: {
				totalCalled: [
					{
						$match: {
							satisfaction: {
								$not: { $regex: /^\[hide\]/ },
								$ne: null
							}
						}
					},
					{
						$sort: { start: -1 }
					},
					{
						$group: {
							_id: '$client',
							status: { $first: '$status' }
						}
					},
					{
						$match: {
							status: false
						}
					}
				],
				totalToRecall: [
					{
						$group: {
							_id: '$client',
							status: { $first: '$status' }
						}
					},
					{
						$match: {
							status: true
						}
					}
				],
				totalValidate: [
					{
						$match: {
							satisfaction: {
								$regex: /^\[hide\]/,
								$ne: null
							}
						}
					}
				],
				inProgress: [
					{
						$count: 'inProgress'
					}
				]
			}
		}
	]);

	const totalUser = await Client.countDocuments({ campaigns: campaign });

	res.status(200).send({
		message: 'OK',
		OK: true,
		data: {
			totalCalled: result[0]?.totalCalled.length || 0,
			totalValidate: result[0]?.totalValidate.length || 0,
			totalToRecall: result[0]?.totalToRecall.length || 0,
			totalUser: totalUser,
			inProgress: result[0]?.inProgress?.length > 0 ? result[0].inProgress[0].inProgress : 0
		}
	});

	log(`[${req.body.area}, ${ip}] call stats get`, 'INFO', __filename);
}
