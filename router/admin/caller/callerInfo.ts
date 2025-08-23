import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck } from '../../../tools/utils';

/**
 * get information of caller
 *
 * @example
 * body:
 * {
 * 	"phone": string,
 * 	"adminCode": string,
 * 	"area": string,
 * 	"CampaignId": string
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400}: Wrong phone number
 * @throws {404}: no area found
 * @throws {404}: no caller found
 * @throws {404}: no campaign active
 * @throws {404}: No data found
 * @throws {200}: OK
 */
export default async function callerInfo(req: Request<any>, res: Response<any>) {
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
				['CampaignId', 'ObjectId', true],
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

	const area = await Area.findOne({ _id: { $eq: req.body.area }, adminPassword: { $eq: password } }, [
		'name',
		'campaignList'
	]);
	if (!area) {
		res.status(404).send({ message: 'no area found', OK: false });
		log(`[!${req.body.area}, ${ip}] no area found`, 'WARNING', __filename);
		return;
	}

	const caller = await Caller.findOne({ phone: { $eq: phone }, campaigns: { $in: area.campaignList } }, [
		'_id',
		'name',
		'phone'
	]);
	if (!caller) {
		res.status(404).send({ message: 'no caller found', OK: false });
		log(`[${ip}, ${req.body.area}] no caller found`, 'WARNING', __filename);
		return;
	}

	if (!req.body.CampaignId) {
		const campaign = await Campaign.findOne({ area: area.id, active: true });
		if (campaign) {
			req.body.CampaignId = campaign._id.toString();
		} else {
			res.status(404).send({ message: 'no campaign active', OK: false });
			log(`[${ip}, ${req.body.area}] no actual campaign`, 'WARNING', __filename);
			return;
		}
	}
	if (!req.body.CampaignId) {
		res.status(404).send({ message: 'no campaign active', OK: false });
		log(`[${ip}, ${req.body.area}] no actual campaign`, 'WARNING', __filename);
		return;
	}

	const data: Array<{
		count: number;
		totalDuration: number;
		rank: number;
	}> = await Call.aggregate([
		{
			$match: {
				campaign: ObjectId.createFromHexString(req.body.CampaignId)
			}
		},
		{
			$group: {
				_id: '$caller',
				count: { $sum: 1 },
				totalDuration: { $sum: '$duration' }
			}
		},
		{
			$match: {
				count: { $gt: 0 }
			}
		},
		{
			$sort: { count: -1 }
		},
		{
			$lookup: {
				from: 'callers',
				localField: '_id',
				foreignField: '_id',
				as: 'caller'
			}
		},
		{
			$project: {
				_id: 1,
				name: { $arrayElemAt: ['$caller.name', 0] },
				count: 1,
				totalDuration: 1
			}
		},
		{
			$setWindowFields: {
				sortBy: { count: -1 },
				output: {
					rank: { $rank: {} }
				}
			}
		},
		{
			$match: {
				_id: caller._id
			}
		}
	]);
	if (!data) {
		res.status(404).send({ message: 'No data found', OK: false });
		log(`[${ip}, ${req.body.area}] No data found`, 'WARNING', __filename);
		return;
	}

	if (data.length == 0) {
		data[0] = {
			totalDuration: 0,
			count: 0,
			rank: 1
		};
	}
	res.status(200).send({
		message: 'OK',
		OK: true,
		data: {
			id: caller._id,
			name: caller.name,
			phone: caller.phone,
			totalTimeCampaign: data[0].totalDuration,
			nbCallsCampaign: data[0].count,
			rank: data[0].rank
		}
	});

	log(`[${ip}, ${req.body.area}] Caller info get`, 'INFO', __filename);
}
