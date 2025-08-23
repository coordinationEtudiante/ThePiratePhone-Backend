import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck } from '../../../tools/utils';

/**
 * get client info
 *
 * @example
 * body:{
 * 	phone: string,
 * 	adminCode: string,
 * 	area: string,
 * 	campaign: string,
 *	"allreadyHased": boolean
 * }
 *
 * @throws {400} if missing parameters
 * @throws {400} - bad hash for admin code
 * @throws {400} if wrong phone number
 * @throws {401} if wrong admin code
 * @throws {404} if user not found
 * @throws {404} if client not found
 * @throws {200} if OK
 * @throws {200} if no call found for this client
 */
export default async function clientInfo(req: Request<any>, res: Response<any>) {
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
				['phone', 'string'],
				['area', 'ObjectId'],
				['campaign', 'string', true],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const phone = clearPhone(req.body.phone);
	if (!phoneNumberCheck(phone)) {
		res.status(400).send({ message: 'Wrong phone number', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong phone number`, 'WARNING', __filename);
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

	if (req.body.campaign) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.campaign }, area: area._id });
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true });
	}
	if (!campaign) {
		res.status(404).send({ message: 'Campaign not found', OK: false });
		log(`[${req.body.area}, ${ip}] Campaign not found`, 'WARNING', __filename);
		return;
	}

	const client = await Client.findOne({ phone: phone, campaigns: campaign._id });
	if (!client) {
		res.status(404).send({ message: 'Client not found', OK: false });
		log(`[${req.body.area}, ${ip}] Client not found`, 'WARNING', __filename);
		return;
	}

	const call = await Call.find({ client: client._id, campaign: campaign._id, duration: { $ne: null } }, [
		'duration',
		'caller',
		'satisfaction',
		'status',
		'start',
		'comment',
		'priority'
	]);
	if (!call || call.length === 0) {
		res.status(200).send({
			OK: true,
			data: { client: client, call: null },
			message: 'no call found for this client'
		});
		log(`[${req.body.area}, ${ip}] No call found for this client`, 'INFO', __filename);
		return;
	}

	const calls: Array<any> = [];
	for (const c of call) {
		const caller = await Caller.findOne({ _id: c.caller, campaigns: { $in: area.campaignList } });
		calls.push({ call: c, caller: caller });
	}

	res.status(200).json({
		OK: true,
		data: { client: client, call: calls },
		message: 'Client info got'
	});
	log(`[${req.body.area}, ${ip}] Client info got`, 'INFO', __filename);
}
