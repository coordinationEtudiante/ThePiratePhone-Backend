import { Request, Response } from 'express';
import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck } from '../../../tools/utils';

/**
 * Remove a caller
 *
 * @example
 * body:{
 * 	"adminCode": string,
 * 	"phone": string,
 * 	"area": string
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400}: adminCode is not a hash
 * @throws {400}: Wrong phone number
 * @throws {400}: Invalid area
 * @throws {400}: Caller not found
 * @throws {500}: Error while removing caller
 * @throws {200}: Caller removed
 */
export default async function removeCaller(req: Request<any>, res: Response<any>) {
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
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const phone = clearPhone(req.body.phone);

	if (!phoneNumberCheck(phone)) {
		res.status(400).send({ message: 'Wrong phone number', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong phone number for remove caller by admin`, 'WARNING', __filename);
		return;
	}
	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } });
	if (!area) {
		res.status(400).send({ message: 'Invalid area', OK: false });
		log(`[!${req.body.area}, ${ip}] Invalid area`, 'WARNING', __filename);
		return;
	}

	const caller = await Caller.findOne({ phone: phone, campaigns: { $in: area.campaignList } });
	if (!caller) {
		res.status(400).send({ message: 'Caller not found', OK: false });
		log(`[${ip}, ${req.body.area}] Caller not found`, 'WARNING', __filename);
		return;
	}

	const curentCall = await Call.findOne({ caller: caller._id, satisfaction: 'In progress' }, ['id']);
	if (curentCall) {
		await Call.deleteMany({ caller: caller._id, satisfaction: 'In progress' });
		log(
			`[${ip}, ${req.body.area}] Call removed (for remove user ${caller._id}): ${curentCall.id}`,
			'INFO',
			__filename
		);
	}
	const remove = await Caller.deleteOne({ phone: phone });
	if (remove.deletedCount == 1) {
		res.status(200).send({ message: 'Caller removed', OK: true });
		log(`[${ip}, ${req.body.area}] Caller removed: ${caller._id}`, 'INFO', __filename);
	} else {
		res.status(500).send({ message: 'Error while removing caller', OK: false });
		log(`[${ip}, ${req.body.area}] Error while removing caller: ${caller._id}`, 'ERROR', __filename);
	}
}
