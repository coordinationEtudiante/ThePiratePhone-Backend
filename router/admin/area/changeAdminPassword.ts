import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, sanitizeString } from '../../../tools/utils';
import { sha512 } from 'js-sha512';

/**
 * change the users password of an area
 *
 * @example
 * body:
 * {
 * 	"adminCode": string,
 * 	"area": mongoDBID,
 * 	"newPassword": string,
 * 	"allreadyHashed": boolean
 * }
 *
 * @throws {400}: new password is not a hash
 * @throws {400}: Missing parameters
 * @throws {400}: bad new admin password
 * @throws {404}: no area found
 * @throws {200}: password of area changed
 */
export default async function ChangeAdminPassword(req: Request<any>, res: Response<any>) {
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
				['newPassword', 'string'],
				['allreadyHashed', 'boolean', true]
			],
			ip
		)
	)
		return;

	if (req.body.newPassword.trim() == '') {
		res.status(400).send({ OK: false, message: 'bad new admin password' });
		log(`[!${req.body.area}, ${ip}] bad new admin password`, 'WARNING', __filename);
		return;
	}

	if (req.body.newPassword.length > 512) {
		//max size
		res.status(400).send({ OK: false, message: 'new password is too long (max 512)' });
		log(`[!${req.body.area}, ${ip}] new password is too long`, 'WARNING', __filename);
		return;
	}

	if (!req.body.allreadyHashed || req.body.newPassword.length != 128) {
		//create hash
		req.body.newPassword = sha512(req.body.newPassword);
	} else {
		if (req.body.newPassword != sanitizeString(req.body.newPassword)) {
			res.status(400).send({ OK: false, message: 'new password is not a hash' });
			log(`[!${req.body.area}, ${ip}] new password is not a hash`, 'WARNING', __filename);
			return;
		}
	}

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const update = await Area.updateOne(
		{ _id: { $eq: req.body.area }, adminPassword: { $eq: password } },
		{ adminPassword: req.body.newPassword }
	);
	if (update.matchedCount != 1) {
		res.status(404).send({ OK: false, message: 'no area found' });
		log(`[!${req.body.area}, ${ip}] no area found from`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ OK: true, message: 'password of area changed' });
	log(`[${req.body.area}, ${ip}] admin password of area changed from`, 'WARNING', __filename);
}
