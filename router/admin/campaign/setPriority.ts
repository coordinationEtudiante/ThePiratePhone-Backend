import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, sanitizeString } from '../../../tools/utils';

/**
 * Set the priority of a campaign
 *
 * @example
 * body:{
 * 	"adminCode": string,
 * 	"priority": Array<{ name: string, id: string(length = 8) }>,
 * 	"area": mongoDBID,
 * 	"CampaignId": mongoDBID,
 * 	"allreadyHashed": boolean
 * }
 *
 * @throws {400} - Missing parameters
 * @throws {400} - bad hash for admin code
 * @throws {400} - Invalid priority, priority must be a array<{ name: string, id: string(length = 8) }>
 * @throws {401} - Wrong admin code
 * @throws {401} - Wrong campaign id
 * @throws {200} - OK
 */
export default async function setPriority(req: Request<any>, res: Response<any>) {
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
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;

	if (!req.body.priority || !Array.isArray(req.body.priority)) {
		res.status(400).send({
			message: 'Invalid priority, priority must be a array<{ name: string, id: string(length = 8) }>',
			OK: false
		});
		log(`[!${req.body.area}, ${ip}] Invalid priority`, 'WARNING', __filename);
		return;
	}

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } });
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null = null;

	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id }, [
			'_id',
			'name',
			'sortGroup'
		]);
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true }, ['_id', 'name', 'sortGroup']);
	}
	if (!campaign) {
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}

	if (
		!req.body.priority.every(
			(e: any) => typeof e?.name === 'string' && typeof e?.id === 'string' && (e?.id.length == 8 || e?.id == '-1')
		)
	) {
		res.status(400).send({
			message: 'Invalid priority, priority must be a array<{ name: string, id: string(length = 8) }>',
			OK: false
		});
		log(`[${req.body.area}, ${ip}] Invalid priority`, 'WARNING', __filename);
		return;
	}

	const priority = req.body.priority.map((e: any) => ({
		name: sanitizeString(e.name),
		id: e.id
	}));
	priority.push({ name: 'default', id: '-1' });

	await Campaign.updateOne({ _id: campaign._id }, { sortGroup: priority });
	res.status(200).send({ message: 'Priority updated', OK: true });
	log(`[${req.body.area}, ${ip}] Priority updated for ${campaign.name}`, 'INFO', __filename);
}
