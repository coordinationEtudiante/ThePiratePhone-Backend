import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
let clientId: mongoose.Types.ObjectId | undefined;
const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Client.deleteMany({});

	areaId = (
		await Area.create({
			name: 'removeClientsTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'removeClientsTest',
			script: 'removeClientsTest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		})
	).id;

	clientId = (
		await Client.create({
			name: 'removeClientsTest',
			phone: '+33134567890',
			area: areaId,
			campaign: campaignId,
			priority: [{ campaign: campaignId, id: '-1' }]
		})
	).id;
	Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/client/removeClients', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/client/removeClients').send({
			adminCode: 'wrongPassword',
			area: areaId
		});
		expect(res.status).toEqual(401);
		expect(res.body).toEqual({ message: 'Wrong admin code', OK: false });
	});

	it('should return 401 if wrong campaign id', async () => {
		const res = await request(app).post('/admin/client/removeClients').send({
			adminCode,
			area: areaId,
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toEqual(401);
		expect(res.body).toEqual({ message: 'Wrong campaign id', OK: false });
	});

	it('should return 200 if OK', async () => {
		const res = await request(app).post('/admin/client/removeClients').send({
			adminCode,
			area: areaId,
			CampaignId: campaignId,
			allreadyHashed: true
		});
		expect(res.status).toEqual(200);
		expect(res.body).toEqual({ message: 'OK', OK: true });
		const clients = await Client.find({ campaigns: campaignId });
		expect(clients.length).toEqual(0);
	});
});
