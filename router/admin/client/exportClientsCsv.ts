import { format } from '@fast-csv/format';
import { Request, Response } from 'express';

import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { log } from '../../../tools/log';
import { checkParameters, hashPasword, humainPhone } from '../../../tools/utils';

/**
 * export clients in csv
 *
 * @example
 * body:{
 * 	adminCode: string,
 * 	area: string,
 * 	CampaignId?: string,
 *	"allreadyHased": boolean
 * }
 *
 * @throws {400} bad hash for admin code
 * @throws {400} if missing parameters
 * @throws {401} if wrong admin code
 * @throws {401} if wrong campaign id
 * @throws {500} if internal server error
 * @throws {200} if OK
 */
export default async function exportClientCsv(req: Request<any>, res: Response<any>) {
	const ip =
		(Array.isArray(req.headers['x-forwarded-for'])
			? req.headers['x-forwarded-for'][0]
			: req.headers['x-forwarded-for']?.split(',')?.[0] ?? req.ip) ?? 'no IP';
	const timeStart = Date.now();
	if (
		!checkParameters(
			req.body,
			res,
			[
				['adminCode', 'string'],
				['area', 'ObjectId'],
				['CampaignId', 'string', true],
				['allreadyHashed', 'boolean', true]
			],
			__filename
		)
	)
		return;
	const password = hashPasword(req.body.adminCode, req.body.allreadyHashed, res);
	if (!password) return;
	const area = await Area.findOne({ adminPassword: { $eq: password }, _id: { $eq: req.body.area } }, ['name']);
	if (!area) {
		res.status(401).send({ message: 'Wrong admin code', OK: false });
		log(`[!${req.body.area}, ${ip}] Wrong admin code`, 'WARNING', __filename);
		return;
	}

	let campaign: InstanceType<typeof Campaign> | null = null;

	if (req.body.CampaignId) {
		campaign = await Campaign.findOne({ _id: { $eq: req.body.CampaignId }, area: area._id }, []);
	} else {
		campaign = await Campaign.findOne({ area: area._id, active: true }, []);
	}
	if (!campaign || campaign == null) {
		res.status(401).send({ message: 'Wrong campaign id', OK: false });
		log(`[${req.body.area}, ${ip}] Wrong campaign id`, 'WARNING', 'changeCallHours.ts');
		return;
	}

	let selector = { campaigns: campaign._id };
	log(`[${req.body.area}, ${ip}] Exporting clients`, 'INFO', __filename);
	res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
	res.setHeader('Content-Type', 'text/csv');

	const csvStream = format({ headers: true, delimiter: ';' });
	csvStream.pipe(res);

	const numberOfClients = await Client.countDocuments(selector);
	const clients = Client.find(selector).cursor();
	await clients.eachAsync(async client => {
		const csvData: {
			statut?: string;
			resultat?: string;
			appeleant?: string;
			commentaire?: string;
			nombreAppel?: number;
		} = {};
		const lastCall = await Call.findOne({ client: client._id, campaign: campaign?._id }).sort({ start: -1 });
		if (lastCall) {
			csvData.statut = lastCall.status ? 'Appelé·e' : 'À rappelé·e';
			csvData.resultat = lastCall?.satisfaction ?? 'Aucune info';
			csvData.appeleant = (await Caller.findById(lastCall?.caller, ['name']))?.name ?? 'Erreur';
			csvData.commentaire = lastCall?.comment ?? '';
			csvData.nombreAppel = (await Call.countDocuments({ client: client._id, campaign: campaign?._id })) ?? -1;
		}
		csvStream.write({
			nom: client.name,
			prenom: client.firstname,
			telephone: humainPhone(client.phone),
			statut: csvData.statut ?? 'Pas appelé·e',
			resultat: csvData.resultat ?? '',
			appeleant: csvData.appeleant ?? '',
			commentaire: csvData.commentaire ?? '',
			nombreAppel: csvData.nombreAppel ?? 0
		});
	});
	csvStream.end();
	res.end();
	log(
		`[${req.body.area}, ${ip}] Exported ${numberOfClients} clients in ${Date.now() - timeStart}`,
		'INFO',
		__filename
	);
}
