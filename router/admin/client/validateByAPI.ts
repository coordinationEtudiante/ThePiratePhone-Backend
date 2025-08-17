import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, partialSearchClient, sanitizeString } from '../../../tools/utils';

/**
 * Search for clients with name, fist name and patial phone
 * @readMe if you have an partial phone use'it, this greatly reduces complexity
 *
 * @example
 * body: {
 * 	name: String,
 * 	firstName: String,
 * 	phoneFragmentStart: String,
 * 	phoneFragmentEnd: String,
 * 	adminCode: String,
 * 	area: ObjectId,
 * 	allreadyHased: boolean
 * 	CampaignId?: ObjectId
 * }
 *
 * @throws {400} Missing parameters
 * @throws {400} bad hash for admin code
 * @throws {401} Wrong admin code
 * @throws {200} OK
 */
export default async function validateByAPI(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	if (
		!checkParameters(
			req.body,
			res,
			[
				['name', 'string'],
				['firstName', 'string'],
				['adminCode', 'string'],
				['area', 'ObjectId'],
				['comment', 'string'],
				['phoneFragmentStart', 'string', true],
				['phoneFragmentEnd', 'string', true],
				['CampaignId', 'string', true],
				['allreadyHaseded', 'boolean', true]
			],
			__filename
		)
	)
		return;

	const password = hashPasword(req.body.adminCode, req.body.allreadyHaseded, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } }, ['_id']);
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null;
	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id }, ['_id']);
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true }, ['_id']);
	}

	if (!campaign) {
		res.status(404).send({ message: 'No campaign in progress', OK: false });
		log(`[!${req.body.area}, ${ip}] No campaign in progress`, 'WARNING', __filename);
		return;
	}

	const result = await partialSearchClient(
		campaign,
		req.body.name,
		req.body.firstName,
		req.body.phoneFragmentStart,
		req.body.phoneFragmentEnd
	);

	if (!result.OK || !result.data || !result.data['_id']) {
		res.status(404).send({ message: 'no clients found on second pass', OK: false });
		log(`[${req.body.area}, ${ip}] no clients found on second pass`, 'INFO', __filename);
		return;
	}

	const allreadyCalled = await Call.findOne({ client: result.data._id, campaign: campaign._id, status: false });

	if (allreadyCalled) {
		res.status(200).send({ message: 'this client is already called by an reel caller', OK: true });
	}

	const APICaller = await getApiCaller();
	const call = await new Call({
		client: result.data._id,
		caller: APICaller._id,
		campaign: campaign._id,
		satisfaction: '[hide] validate by API',
		comment: sanitizeString(req.body.comment),
		status: false,
		start: new Date(),
		duration: 0
	}).save();

	if (!call) {
		res.status(500).send({ message: 'Internal error when creating validation call', OK: false });
		log(`[${req.body.area}, ${ip}] Internal error when creating validation call`, 'CRITICAL', __filename);
		return;
	}

	res.status(200).send({ message: 'this client has been validate', OK: true });
	log(`[${req.body.area}, ${ip}] client ${result.data._id} has ben validate`, 'INFO', __filename);

	async function getApiCaller() {
		let caller: InstanceType<typeof Caller> | null = await Caller.findOne({
			name: 'API Caller',
			phone: '+33000000000',
			pinCode: '1970'
		});
		if (!caller) {
			caller = await new Caller({
				name: 'API Caller',
				phone: '+33000000000',
				pinCode: '1970',
				campaigns: await Campaign.find({}, [])
			}).save();
		}

		return caller;
	}
}
