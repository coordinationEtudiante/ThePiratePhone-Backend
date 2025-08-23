import { Request, Response } from 'express';

import { checkParameters, hashPasword } from '../../../tools/utils';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';

/**
 * Create a campaign
 * @example
 * body:{
 * 	"name": string,
 * 	"script": string,
 * 	"adminCode": string,
 * 	"password": string,
 * 	"callHoursStart": number,
 * 	"callHoursEnd": number,
 * 	"satisfactions": string[],
 * 	"area": mongoDBID,
 *	"allreadyHashed": boolean
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400} - bad hash for admin code
 * @throws {400}: Invalid satisfaction satisfactions must be a array<string>
 * @throws {401}: Wrong admin code
 * @throws {400}: Campaign already exist
 * @throws {200}: Campaign created
 * @throws {500}: Internal error
 **/
export default async function createCampaign(req: Request<any>, res: Response<any>) {
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
				['script', 'string'],
				['adminCode', 'string'],
				['password', 'string'],
				['callHoursStart', 'number', true],
				['callHoursEnd', 'number', true],
				['area', 'ObjectId'],
				['allreadyHashed', 'boolean', true]
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

	if (
		req.body.satisfactions &&
		!req.body.satisfactions.every((e: any) => {
			typeof e?.name == 'string' && typeof e?.toRecall == 'boolean';
		})
	) {
		res.status(400).send({ message: 'Invalid satisfaction, satisfactions must be a array<string>', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid satisfaction`, 'WARNING', __filename);
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

	if ((await Campaign.findOne({ name: { $eq: req.body.name.trim() }, area: area._id })) != null) {
		res.status(400).send({ message: 'Campaign already exist', OK: false });
		log(`[${ip}, ${req.body.area}] Campaign already exist`, 'WARNING', __filename);
		return;
	}

	const campaign = new Campaign({
		area: area._id,
		name: req.body.name,
		script: req.body.script,
		password: req.body.password,
		callHoursStart: req.body.callHoursStart,
		callHoursEnd: req.body.callHoursEnd,
		status: req.body.satisfactions
	});
	await campaign.save();
	await Area.updateOne({ _id: area._id }, { $push: { CampaignList: campaign._id } });
	res.status(200).send({ message: 'Campaign created', OK: true });
	log(`[${ip}, ${req.body.area}] Campaign created`, 'INFO', __filename);
}
