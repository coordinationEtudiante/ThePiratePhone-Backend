import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, sanitizeString } from '../../../tools/utils';

/**
 * change the name of an area
 *
 * @example
 * body:
 * {
 * 	"adminCode": string,
 * 	"area": mongoDBID,
 * 	"newName": string
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400}: adminCode is not a hash
 * @throws {400}: bad new name
 * @throws {404}: no area found
 * @throws {200}: name of area changed
 */
export default async function ChangeName(req: Request<any>, res: Response<any>) {
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
				['newName', 'string'],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;
	req.body.newName = req.body.newName.trim();
	if (req.body.newName == '' || req.body.newName.length > 50) {
		res.status(400).send({ OK: false, message: 'bad new name' });
		log(`[!${req.body.area}, ${ip}] bad new name`, 'WARNING', __filename);
		return;
	}

	req.body.newName = sanitizeString(req.body.newName);
	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const update = await Area.updateOne(
		{ _id: { $eq: req.body.area }, adminPassword: password },
		{ name: req.body.newName }
	);
	if (update.matchedCount != 1) {
		res.status(404).send({ OK: false, message: 'no area found' });
		log(`[!${req.body.area}, ${ip}] no area found`, 'WARNING', __filename);
		return;
	}

	res.status(200).send({ OK: true, message: 'name of area changed' });
	log(`[${req.body.area}, ${ip}] name of area changed to ${req.body.newName}`, 'WARNING', __filename);
}
