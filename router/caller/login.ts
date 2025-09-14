import { Request, Response } from 'express';
import { Types } from 'mongoose';

import { Caller } from '../../Models/Caller';
import { Campaign } from '../../Models/Campaign';
import { log } from '../../tools/log';
import { checkParameters, checkPinCode, clearPhone, phoneNumberCheck } from '../../tools/utils';

/**
 * get if your credential is valid
 * @example
 * body:{
 * 	"phone": string,
 * 	"pinCode": string  {max 4 number}
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400}: Wrong pin code
 * @throws {400}: Invalid phone number
 * @throws {403}: Invalid credential
 * @throws {200}: Logged in
 */
export default async function login(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';

	if (!req.body || typeof req.body.phone != 'string' || typeof req.body.pinCode != 'string') {
		res.status(400).send({ message: 'Missing parameters', OK: false });
		log(`[!${req.body.phone}, ${ip}] Missing parameters`, 'WARNING', __filename);
		return;
	}
	if (req.body.pinCode.length != 4) {
		res.status(400).send({ message: 'Wrong pin code', OK: false });
		log(`[!${req.body.phone}, ${ip}] Wrong pin code`, 'WARNING', __filename);
		return;
	}

	if (
		!checkParameters(
			req.body,
			res,
			[
				['phone', 'string'],
				['pinCode', 'string']
			],
			__filename
		)
	)
		return;

	if (!checkPinCode(req.body.pinCode, res, __filename)) return;

	const phone = clearPhone(req.body.phone);
	if (!phoneNumberCheck(phone)) {
		res.status(400).send({ message: 'Invalid phone number', OK: false });
		log(`[!${req.body.phone}, ${ip}] Invalid phone number`, 'WARNING', __filename);
		return;
	}
	const caller = await Caller.findOne({ phone: phone, pinCode: { $eq: req.body.pinCode } }, [
		'name',
		'campaigns',
		'phone'
	]);
	if (!caller) {
		res.status(403).send({ message: 'Invalid credential', OK: false });
		log(`[!${req.body.phone}, ${ip}] Invalid credential`, 'WARNING', __filename);
		return;
	}
	let campaignAvailable: {
		name: string;
		callHoursEnd: Date | null | undefined;
		callHoursStart: Date | null | undefined;
		_id: Types.ObjectId;
		areaId: Types.ObjectId;
		areaName: string;
		status: Array<{ name?: string | null | undefined; toRecall?: boolean | null | undefined }>;
	}[];

	try {
		campaignAvailable = await Campaign.aggregate([
			{
				$match: {
					_id: { $in: caller.campaigns },
					active: true
				}
			},
			{
				$lookup: {
					from: 'areas',
					localField: 'area',
					foreignField: '_id',
					as: 'areaDetails'
				}
			},
			{
				$unwind: '$areaDetails'
			},
			{
				$project: {
					name: 1,
					callHoursStart: 1,
					callHoursEnd: 1,
					status: 1,
					areaId: '$areaDetails._id',
					areaName: '$areaDetails.name'
				}
			}
		]);

		if (
			!campaignAvailable ||
			campaignAvailable.length === 0 ||
			!campaignAvailable.every(c => c.areaId != undefined && c.areaId != null)
		) {
			res.status(500).send({ message: 'area of campaign not found', OK: false });
			log(`[${req.body.phone}, ${ip}] area of campaign not found`, 'WARNING', __filename);
			return;
		}
	} catch (error) {
		res.status(500).send({ message: 'area of campaign not found', OK: false });
		log(`[${req.body.phone}, ${ip}] area of campaign not found`, 'ERROR', __filename);
		return;
	}

	res.status(200).send({ message: 'OK', OK: true, data: { caller: caller, campaignAvailable } });
	log(`[${req.body.phone}, ${ip}] Login success`, 'INFO', __filename);
	return;
}
