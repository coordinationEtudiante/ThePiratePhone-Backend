import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, sanitizeString } from '../../../tools/utils';

/**
 * set sms to send
 *
 * @example
 * body:
 * {
 * 	"adminCode": string,
 * 	"campaign": string,
 * 	"area": string,
 * 	"allreadyHashed": boolean,
 * 	"script": string,
 * 	"sendEndCall": boolean
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong admin code
 * @throws {404} Campaign not found
 * @throws {200} Campaign activated
 * @throws {200} Campaign deactivated
 */
export default async function SetSendSms(req: Request<any>, res: Response<any>) {
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
				['script', 'string'],
				['sendEndCall', 'boolean'],
				['campaign', 'string', true],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } });
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	req.body.script = sanitizeString(req.body.script);

	console.log(req.body.script);
	if (req.body.script == '') {
		res.status(401).send({ message: 'invalid script', OK: false });
		log(`[!${req.body.area}, ${ip}] invalid script`, 'WARNING', __filename);
		return;
	}

	let change;
	if (req.body.campaign) {
		change = await Campaign.updateOne(
			{ _id: { $eq: req.body.campaign }, area: area._id },
			{ smsScript: req.body.script, sendEndCall: req.body.sendEndCall }
		);
	} else {
		change = await Campaign.updateOne(
			{ area: area._id, active: true },
			{ smsScript: req.body.script, sendEndCall: req.body.sendEndCall }
		);
	}

	if (change.matchedCount != 1) {
		res.status(404).send({ message: 'Campaign not found', OK: false });
		log(`[${req.body.area}, ${ip}] Campaign not found`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ message: 'campaign sms updated', OK: true });
	log(`[${req.body.area}, ${ip}] Campaign sms updated`, 'INFO', __filename);
}
