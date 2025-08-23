import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { log } from '../../../tools/log';
import sms from '../../../tools/sms';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck } from '../../../tools/utils';

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
				['allreadyHashed', 'boolean', true],
				['message', 'string']
			],
			__filename
		)
	)
		return;

	if (req.body.phone && (!Array.isArray(req.body.phone) || req.body.phone.length === 0)) {
		res.status(400).send({ message: 'Invalid phone, phone must be a array<[phone, name]>', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid phone`, 'WARNING', __filename);
		return;
	}

	let errored = false;
	req.body.phone.forEach((phone: [string, string | undefined]) => {
		if ((!errored && typeof phone[0] !== 'string') || !phoneNumberCheck(clearPhone(phone[0]))) {
			errored = true;
			res.status(400).send({ message: 'Invalid phone number', OK: false });
			log(`[!${req.body.area}, ${ip}] Invalid phone number: ${phone[0]}`, 'WARNING', __filename);
			return;
		}
	});
	if (errored) {
		return;
	}

	//pass phone to [name, phone]
	req.body.phone = req.body.phone.map((phone: string | [string, string | undefined]) => {
		if (Array.isArray(phone) && phone.length === 2) {
			return [phone[1], clearPhone(phone[0])];
		}
	});

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } }, ['adminPhone']);
	if (!area) {
		res.status(404).send({ message: 'no area found, or bad password', OK: false });
		log(`[!${req.body.area}, ${ip}] no area found, or bad password`, 'WARNING', __filename);
		return;
	}

	if (sms.enabled) {
		sms.sendSms(req.body.phone, req.body.message)
			.then(() => {
				res.status(200).send({ OK: true, message: 'SMS sent successfully' });
				log(`[${req.body.area}, ${ip}] SMS sent to ${req.body.phone}`, 'INFO', __filename);
			})
			.catch(err => {
				res.status(500).send({ OK: false, message: `Failed to send SMS: ${err.message}` });
				log(`[${req.body.area}, ${ip}] Failed to send SMS: ${err.message}`, 'ERROR', __filename);
			});
	} else {
		res.status(503).send({ OK: false, message: 'SMS service is not enabled' });
		log(`[${req.body.area}, ${ip}] SMS service is not enabled`, 'WARNING', __filename);
		return;
	}
}
