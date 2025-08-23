import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Caller } from '../../../Models/Caller';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck, sanitizeString } from '../../../tools/utils';

/**
 * change caller name
 *
 * @example
 * body:
 * {
 * 	"adminCode": string,
 * 	"phone": string,
 * 	"newName": string,
 * 	"area": string
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400}: adminCode is not a hash
 * @throws {400}: Wrong phone number
 * @throws {401}: Wrong admin code
 * @throws {400}: Caller not found
 * @throws {200}: OK
 */
export default async function ChangeName(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers[`x-forwarded-for`])
			? req.headers[`x-forwarded-for`][0]
			: req.headers[`x-forwarded-for`]?.split(`,`)?.[0] ?? req.ip) ?? `no IP`;

	if (
		!checkParameters(
			req.body,
			res,
			[
				[`adminCode`, `string`],
				[`phone`, `string`],
				[`newName`, `string`],
				[`area`, `ObjectId`],
				[`allreadyHashed`, `boolean`, true]
			],
			__filename
		)
	)
		return;

	const phone = clearPhone(req.body.phone);
	if (!phoneNumberCheck(phone)) {
		res.status(400).send({ message: `Wrong phone number`, OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong phone number`, `WARNING`, __filename);
		return;
	}
	req.body.newName = sanitizeString(req.body.newName);
	if (req.body.newName == `` || req.body.newName.length > 50 || req.body.newName.length < 3) {
		res.status(400).send({ message: `Wrong newName`, OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong newName`, `WARNING`, __filename);
		return;
	}

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } });
	if (!area) {
		res.status(401).send({ message: `Wrong admin code`, OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, `WARNING`, __filename);
		return;
	}

	const change = await Caller.updateOne(
		{ phone: phone, campaigns: { $in: area.campaignList } },
		{ name: req.body.newName }
	);
	if (change.matchedCount != 1) {
		res.status(400).send({ message: `Caller not found`, OK: false });
		log(`[${ip}, ${req.body.area}] Caller not found`, `WARNING`, __filename);
		return;
	}

	res.status(200).send({ message: `Caller name changed`, OK: true });
	log(`[${ip}, ${req.body.area}] Caller name changed`, `INFO`, __filename);
}
