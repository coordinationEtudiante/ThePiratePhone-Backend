import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck } from '../../../tools/utils';

export default async function setPhone(req: Request<any>, res: Response<any>) {
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
			__filename
		)
	)
		return;

	if (req.body.phone && (!Array.isArray(req.body.phone) || req.body.phone.length === 0)) {
		res.status(400).send({ message: 'Invalid phone, phone must be a array<[phone, name]>', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid phone`, 'WARNING', __filename);
		return;
	}

	const errored = req.body.phone.some((phoneCombo: [string, string]) => {
		const [phone, name] = [clearPhone(phoneCombo[0]), phoneCombo[1].trim()];
		if (typeof phone !== 'string' || !phoneNumberCheck(phone) || typeof name != 'string') {
			res.status(400).send({ message: 'Invalid phone number', OK: false });
			log(`[!${req.body.area}, ${ip}] Invalid phone number: ${phone}`, 'WARNING', __filename);
			return true;
		}
		return false;
	});

	if (errored) {
		return;
	}

	req.body.phone = req.body.phone.map((phoneCombo: [string, string]) => [
		clearPhone(phoneCombo[0]),
		phoneCombo[1].trim()
	]);

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	const area = await Area.updateOne(
		{ _id: { $eq: req.body.area }, adminPassword: { $eq: password } },
		{ adminPhone: req.body.phone },
		['adminPhone']
	);
	if (area.matchedCount === 0) {
		res.status(404).send({ message: 'no area found, or bad password', OK: false });
		log(`[!${req.body.area}, ${ip}] no area found, or bad password`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ OK: true, message: 'admin phone number updated' });
	log(`[${req.body.area}, ${ip}] admin phone number updated`, 'INFO', __filename);
}
