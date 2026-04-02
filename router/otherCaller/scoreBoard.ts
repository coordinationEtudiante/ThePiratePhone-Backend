import { Request, Response } from 'express';
import mongoose from 'mongoose';

import { Call } from '../../Models/Call';
import { Caller } from '../../Models/Caller';
import { log } from '../../tools/log';
import { checkParameters, clearPhone, getApiCaller, phoneNumberCheck } from '../../tools/utils';

/**
 * get the top 5 callers in a campaign and our score
 *
 * @example
 * body:
 * {
 * 	"phone": string,
 * 	"pinCode": string  {max 4 number}
 * 	"campaignId": mongoDBID
 * }
 *
 * @throws {400}: Missing parameters
 * @throws {400}: Wrong phone number
 * @throws {404}: no campaign in progress
 * @throws {404}: Caller not found
 * @throws {500}: No data found
 * @throws {200}: topfiveUsers
 */

export default async function scoreBoard(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: (req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip)) ?? 'no IP';

	if (
		!checkParameters(
			req.body,
			res,
			[
				['phone', 'string'],
				['pinCode', 'string'],
				['campaign', 'ObjectId']
			],
			__filename
		)
	)
		return;

	const phone = clearPhone(req.body.phone);
	if (!phoneNumberCheck(phone)) {
		res.status(400).send({ message: 'Wrong phone number', OK: false });
		log(`[!${req.body.phone}, ${ip}] Wrong phone number`, 'WARNING', __filename);
		return;
	}

	const caller = await Caller.findOne({
		phone: phone,
		pinCode: { $eq: req.body.pinCode },
		campaigns: { $eq: req.body.campaign }
	});

	const APICaller = await getApiCaller();

	if (!caller) {
		res.status(404).send({ message: 'Caller not found', OK: false });
		log(`[!${req.body.phone}, ${ip}] Caller not found`, 'WARNING', __filename);
		return;
	}
	const topfiveUsers: Array<{
		you: boolean | null;
		_id: mongoose.Types.ObjectId;
		name: string;
		count: number;
		totalDuration: number;
	}> = await Call.aggregate([
		{
			$match: {
				$and: [
					{ campaign: mongoose.Types.ObjectId.createFromHexString(req.body.campaign) },
					{ caller: { $ne: APICaller._id } }
				]
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
			$limit: 5
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
		}
	]);
	let yourPlace = topfiveUsers.findIndex(user => user._id.toString() == caller._id.toString());
	if (!topfiveUsers.find(user => user._id.toString() == caller._id.toString())) {
		const user = (
			await Call.aggregate([
				{
					$match: {
						campaign: mongoose.Types.ObjectId.createFromHexString(req.body.campaign)
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
			])
		)[0];

		if (user) {
			topfiveUsers.push(user);
			yourPlace = user.rank - 1;
		} else {
			topfiveUsers.push({
				you: true,
				_id: caller._id,
				name: caller.name,
				count: 0,
				totalDuration: 0
			});
			yourPlace = (await Caller.countDocuments()) - 1;
		}
	}
	yourPlace++;
	if (!topfiveUsers) {
		res.status(500).send({ message: 'No data found', OK: false });
		log(`[${req.body.phone}, ${ip}] No data found`, 'WARNING', __filename);
		return;
	}
	topfiveUsers.forEach(user => {
		user.you = user._id.toString() == caller._id.toString();
	});
	res.status(200).send({ topfiveUsers, yourPlace, OK: true });
	log(`[${req.body.phone}, ${ip}] Scoreboard sent`, 'INFO', __filename);
}
