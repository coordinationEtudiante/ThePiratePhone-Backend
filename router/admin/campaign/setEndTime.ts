import { Request, Response } from 'express';
import { Area } from 'Models/Area';
import { Campaign } from 'Models/Campaign';
import { log } from 'tools/log';
import { checkParameters, hashPasword } from 'tools/utils';

export default async function sendSms(req: Request<any>, res: Response<any>) {
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
				['CampaignId', 'ObjectId', true],
				['allreadyHashed', 'boolean', true],
				['endTime', 'Date']
			],
			__filename
		)
	)
		return;

	const newDate = new Date(req.body.endTime);
	if (!newDate.toISOString() || isNaN(newDate.getTime())) {
		res.status(400).send({ OK: false, message: `bad new date: ${newDate}` });
		log(`[!${req.body.area}, ${ip}] bad new date result: ${newDate}`, 'WARNING', __filename);
		return;
	}

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } });
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null = null;

	campaign = await Campaign.findOneAndUpdate(
		{
			_id: req.body.CampaignId ? { $eq: req.body.CampaignId } : undefined,
			area: area._id,
			...(req.body.CampaignId ? {} : { active: true })
		},
		{ endTime: newDate },
		{ projection: { _id: 1 } }
	);

	if (!campaign) {
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ message: 'endTime updated', OK: true });
	log(`[${req.body.area}, ${ip}] endTime updated for ${campaign.name}`, 'INFO', __filename);
}
