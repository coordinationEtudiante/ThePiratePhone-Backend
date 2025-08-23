import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, clearPhone, hashPasword, phoneNumberCheck, sanitizeString } from '../../../tools/utils';

/**
 * create clients, max size 500
 * @example
 * body:{
 * 	"adminCode": string,
 * 	"area": string,
 * 	"data": [{phone:string, name?:string, firstname?:string, institution?:string, priority?:string, firstIntegration?:date, integrationReason?:string}],
 * 	"allreadyHashed": boolean
 * 	"defaultReason": string
 * }
 * @throws {400}: missing parameters,
 * @throws {400}: new password is not a hash
 * @throws {400}: to manu users (more of 500)
 * @throws {403}: bad area or adminCode
 * @throws {404}: no campaing in progress
 * @throws {200}: all fine
 */
export default async function createClients(req: Request<any>, res: Response<any>) {
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
				['allreadyHashed', 'boolean', true],
				['defaultReason', 'string', true]
			],
			ip
		)
	)
		return;
	if (!Array.isArray(req.body.data)) {
		res.status(400).send({ message: 'data must be an array', OK: false });
		log(`[!${req.body.area}, ${ip}] data must be an array`, 'WARNING', __filename);
		return;
	}

	if (req.body.data.length > 500) {
		res.status(400).send({ message: 'Too many users', OK: false });
		log(`[!${req.body.area}, ${ip}] Too many users`, 'WARNING', __filename);
		return;
	}

	const isValidData = req.body.data.every((usr: any) => {
		return (
			typeof usr === 'object' &&
			usr !== null &&
			typeof usr.phone === 'string' &&
			(usr.name === undefined || typeof usr.name === 'string') &&
			(usr.firstname === undefined || typeof usr.firstname === 'string') &&
			(usr.institution === undefined || typeof usr.institution === 'string') &&
			(usr.priority === undefined || typeof usr.priority === 'string') &&
			(usr.firstIntegration === undefined || !isNaN(parseInt(usr.firstIntegration))) &&
			(usr.integrationReason === undefined || typeof usr.integrationReason === 'string')
		);
	});

	if (!isValidData) {
		res.status(400).send({
			message:
				'Each data entry must be an object with valid properties: {phone:string, name?:string, firstname?:string, institution?:string, priority?:string, firstIntegration?:date, integrationReason?:string}',
			OK: false
		});
		log(`[!${req.body.area}, ${ip}] Invalid data format`, 'WARNING', __filename);
		return;
	}

	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;

	const area = await Area.findOne(
		{
			_id: { $eq: req.body.area },
			adminPassword: { $eq: password }
		},
		['name']
	);
	if (!area) {
		res.status(403).send({ message: 'area not found or bad admin password', OK: false });
		log(`[!${req.body.area}, ${ip}] area not found or bad admin password`, 'WARNING', __filename);
		return;
	}

	const campaign = await Campaign.findOne({ area: { $eq: area._id }, active: true }, ['sortGroup']);
	if (!campaign) {
		res.status(404).send({ message: 'no campaign in progress', OK: false });
		log(`[${req.body.area}, ${ip}] no campaign in progress`, 'WARNING', __filename);
		return;
	}

	const errors: Array<[string | undefined, string | undefined, string]> = [];
	const sleep: Array<Promise<boolean>> = req.body.data.map(
		async (usr: {
			phone: string;
			name?: string;
			firstname?: string;
			institution?: string;
			priority?: string;
			firstIntegration?: Date;
			integrationReason?: string;
		}) => {
			const priorityId = campaign.sortGroup.find(e => e.name === usr.priority)?.id ?? '-1';
			const phone = clearPhone(usr.phone);
			try {
				if (!phoneNumberCheck(phone)) {
					errors.push([usr.name + ' ' + (usr.firstname || ''), usr.phone, 'Wrong phone number']);
					return false;
				}
				if ((await Client.countDocuments({ phone })) == 0) {
					const user = new Client({
						name: sanitizeString(usr.name || 'unknown'),
						firstname: sanitizeString(usr.firstname || ''),
						phone,
						campaigns: [campaign._id],
						priority: [{ campaign: campaign._id, id: priorityId }],
						firstIntegration: (() => {
							const date = new Date(usr.firstIntegration || '');
							return isNaN(date.getTime()) ? Date.now() : date.getTime();
						})(),
						integrationReason: sanitizeString(usr.integrationReason || '')
					});
					// create it
					await user.save();
					return true;
				} else if ((await Client.countDocuments({ phone, campaigns: { $ne: campaign._id } })) == 1) {
					// client exist in another campaing
					await Client.updateOne(
						{ phone },
						{
							phone,
							name: sanitizeString(usr.name || 'unknown'),
							firstname: sanitizeString(usr.firstname || ''),
							firstIntegration: (() => {
								const date = new Date(usr.firstIntegration || '');
								return isNaN(date.getTime()) ? Date.now() : date.getTime();
							})(),
							integrationReason:
								sanitizeString(usr.integrationReason || '') ?? sanitizeString(req.body.defaultReason)
						},
						{ $push: { campaigns: campaign._id } }
					);
				} else {
					// client exist in this campaign, update name, firstnames and priority
					await Client.updateOne(
						{ phone },
						{
							phone,
							name: sanitizeString(usr.name || 'unknown'),
							firstname: sanitizeString(usr.firstname || ''),
							priority: [{ campaign: campaign._id, id: '-1' }],
							firstIntegration: (() => {
								const date = new Date(usr.firstIntegration || '');
								return isNaN(date.getTime()) ? Date.now() : date.getTime();
							})(),
							integrationReason:
								sanitizeString(usr.integrationReason || '') ?? sanitizeString(req.body.defaultReason)
						}
					);
				}
			} catch (error: any) {
				errors.push([usr.name || '' + ' ' + usr.firstname || '', phone, error.message]);
			}
		}
	);
	await Promise.all(sleep);
	log(`[${req.body.area}, ${ip}] Created ${req.body.data.length - errors.length} users`, 'INFO', __filename);
	res.status(200).send({ message: 'OK', OK: true, errors: errors });
}
