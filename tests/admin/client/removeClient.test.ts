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
			name: 'removeClientTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'removeClientTest',
			script: 'removeClientTest',
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
			name: 'removeClientTest',
			phone: '+33134567890',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		})
	).id;
	Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/client/removeClient', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode: 'wrongPassword',
			area: areaId,
			phone: '+33134567890'
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
	});

	it('should return 400 if wrong phone number', async () => {
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode,
			area: areaId,
			phone: 'wrongPhone',
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.OK).toBe(false);
	});

	it('should return 401 if wrong area', async () => {
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode,
			area: new Types.ObjectId(),
			phone: '+33134567890',
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
	});

	it('should return 401 if wrong campaign id', async () => {
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode,
			area: areaId,
			phone: '+33134567890',
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
	});

	it('should return 404 if client not found', async () => {
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode,
			area: areaId,
			phone: '+33134567891',
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.OK).toBe(false);
	});

	it('should return 200 if OK', async () => {
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode,
			area: areaId,
			phone: '+33134567890',
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.message).toBe('OK');
		const client = await Client.findById(clientId);
		expect(client).toBeNull();
	});

	it('should return 200 if OK with multiple client', async () => {
		await Client.create({
			name: 'removeClientTest',
			phone: '+33134567891',
			area: areaId,
			campaigns: campaignId,
			priority: [{ campaign: campaignId, id: '-1' }]
		});

		await Client.create({
			name: 'removeClientTest',
			phone: '+33134567892',
			area: areaId,
			campaigns: campaignId,
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		const res = await request(app).post('/admin/client/removeClient').send({
			adminCode,
			area: areaId,
			phone: '+33134567892',
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		const client = await Client.find({});
		expect(client.length).toBe(1);
	});
});
