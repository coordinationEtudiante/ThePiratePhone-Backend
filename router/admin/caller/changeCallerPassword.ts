import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Caller } from '../../../Models/Caller';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck } from '../../../tools/utils';

/**
 * change caller password
 *
 * @example
 * body:
 * {
 * 	"adminCode": string,
 * 	"newPassword": string,
 * 	"Callerphone": string,
 * 	"area": string,
 * 	allreadyHashed: boolean
 * }
 *
 * @throws {400}: adminCode is not a hash
 * @throws {400}: Invalid new pin code
 * @throws {400}: Invalid phone number
 * @throws {401}: Wrong admin code
 * @throws {404}: Caller not found or same password
 * @throws {200}: Password changed
 */
export default async function changeCallerPassword(req: Request<any>, res: Response<any>) {
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
				['newPassword', 'string'],
				['Callerphone', 'string'],
				['area', 'ObjectId'],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;

	if (req.body.newPassword.length != 4 || Number.isNaN(parseInt(req.body.newPassword))) {
		res.status(400).send({ message: 'Invalid new pin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid new pin code`, 'WARNING', __filename);
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

	const phone = clearPhone(req.body.Callerphone);
	if (!phoneNumberCheck(phone)) {
		res.status(400).send({ message: 'Invalid phone number', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid phone number`, 'WARNING', __filename);
		return;
	}
	const result = await Caller.updateOne(
		{ phone: phone, campaigns: { $in: area.campaignList } },
		{ pinCode: req.body.newPassword }
	);
	if (result.matchedCount != 1) {
		res.status(404).send({ message: 'Caller not found or same password', OK: false });
		log(`[${ip}, ${req.body.area}] Caller not found or same password from admin`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ message: 'Password changed', OK: true });
	log(`[${ip}, ${req.body.area}] Password of ${phone} changed from admin`, 'INFO', __filename);
}
