import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { log } from '../../../tools/log';
import sms from '../../../tools/sms';
import { checkParameters, hashPasword } from '../../../tools/utils';

export default async function smsStatus(req: Request<any>, res: Response<any>) {
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

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } }, ['adminPhone']);
	if (!area) {
		res.status(404).send({ message: 'no area found', OK: false });
		log(`[!${req.body.area}, ${ip}] no area found`, 'WARNING', __filename);
		return;
	}

	const service = sms.enabled ? (sms.isSmsTools ? 'sms-tools' : 'sms-gateway') : 'inactif';
	const adminPhone = Array.isArray(area.adminPhone) ? [...area.adminPhone] : [];
	adminPhone.push([process.env.SUPERADMIN_PHONE ?? '+33700000000', 'Super Admin']);
	res.status(200).send({
		OK: true,
		data: {
			adminPhone,
			service,
			enabled: sms.enabled
		}
	});
	log(`[${req.body.area}, ${ip}] sms status requested`, 'INFO', __filename);
}
