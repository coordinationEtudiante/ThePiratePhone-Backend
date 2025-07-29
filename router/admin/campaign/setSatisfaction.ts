import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, sanitizeString } from '../../../tools/utils';

/**
 * Set the satisfaction of a campaign
 *
 * @example
 * body:{
 * 	"adminCode": string,
 * 	"satisfactions": Array<{ name: string, toRecall: boolean }>,
 * 	"area": mongoDBID,
 * 	"CampaignId": mongoDBID,
 * 	"allreadyHaseded": boolean
 * }
 *
 * @throws {400} - Missing parameters
 * @throws {400} - bad hash for admin code
 * @throws {400} - Invalid satisfaction satisfactions must be a array<{ name: string, toRecall: boolean }>
 * @throws {401} - Wrong admin code
 * @throws {401} - Wrong campaign id
 * @throws {200} - OK
 */
export default async function setSatisfaction(req: Request<any>, res: Response<any>) {
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
				['CampaignId', 'string', true],
				['allreadyHaseded', 'boolean', true]
			],
			__filename
		)
	)
		return;

	if (req.body.satisfactions && !Array.isArray(req.body.satisfactions)) {
		res.status(400).send({ message: 'Invalid satisfaction, satisfactions must be a array<string>', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid satisfaction`, 'WARNING', __filename);
		return;
	}

	const password = hashPasword(req.body.adminCode, req.body.allreadyHaseded, res);
	if (!password) return;
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } });
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
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}

	if (
		!req.body.satisfactions.every(
			(e: any) =>
				typeof e?.name === 'string' &&
				typeof e?.toRecall === 'boolean' &&
				!e?.name.includes('[hide] validate by API')
		)
	) {
		res.status(400).send({
			message:
				'Invalid satisfaction, satisfactions must be a array<{ name: String, toRecall: Boolean }> name dont contain "[hide] validate by API"',
			OK: false
		});
		log(`[${req.body.area}, ${ip}] Invalid satisfaction`, 'WARNING', __filename);
		return;
	}

	req.body.satisfactions = req.body.satisfactions.map((e: any) => ({
		name: sanitizeString(e.name),
		toRecall: e.toRecall
	}));

	req.body.satisfactions.push({ name: '[hide] validate by API', toRecall: false });

	await Campaign.updateOne({ _id: campaign._id }, { status: req.body.satisfactions });
	res.status(200).send({ message: 'Satisfaction updated', OK: true });
	log(`[${req.body.area}, ${ip}] Satisfaction updated for ${campaign.name}`, 'INFO', __filename);
}
