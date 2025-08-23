import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';

dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
let callerId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
let clientId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Caller.deleteMany({});
	await Area.deleteMany({});
	await Campaign.deleteMany({});
	await Client.deleteMany({});
	await Call.deleteMany({});

	areaId = (
		await Area.create({
			name: 'clientInfotest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;

	callerId = (
		await Caller.create({
			name: 'clientInfotest',
			phone: '+33134567890',
			pinCode: '1234',
			area: areaId,
			campaigns: []
		})
	)?.id;
	campaignId = (
		await Campaign.create({
			name: 'changeCampaignPasswordTest',
			script: 'changeCampaignPasswordTest',
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
			name: 'clientInfotest',
			phone: '+33134567890',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		})
	)?.id;

	Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
	Caller.updateOne({ _id: callerId }, { $push: { campaigns: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/client/clientInfo', () => {
	it('should return 400 if wrong phone number', async () => {
		const res = await request(app).post('/admin/client/clientInfo').send({
			phone: 'wrong',
			adminCode: adminPassword,
			area: areaId,
			campaign: callerId
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Wrong phone number');
	});
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/client/clientInfo').send({
			phone: '+33134567890',
			adminCode: 'wrong',
			area: areaId,
			campaign: callerId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});
	it('should return 404 if campaign not found', async () => {
		const res = await request(app).post('/admin/client/clientInfo').send({
			phone: '+33134567890',
			adminCode: adminPassword,
			area: areaId,
			campaign: new mongoose.Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('Campaign not found');
	});
	it('should return 404 if client not found', async () => {
		const res = await request(app).post('/admin/client/clientInfo').send({
			phone: '+33134567891',
			adminCode: adminPassword,
			area: areaId,
			campaign: campaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('Client not found');
	});
	it('should return 200 if no call found for this client', async () => {
		const res = await request(app).post('/admin/client/clientInfo').send({
			phone: '+33134567890',
			adminCode: adminPassword,
			area: areaId,
			campaign: campaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('no call found for this client');
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			client: {
				name: 'clientInfotest',
				phone: '+33134567890',
				campaigns: [campaignId]
			}
		});
	});
	it('should return 200 if call found for this client', async () => {
		await Call.create({
			client: clientId,
			caller: callerId,
			campaign: campaignId,
			satisfaction: 'finished',
			comment: 'good',
			status: false,
			start: new Date(),
			duration: 100
		});
		const res = await request(app).post('/admin/client/clientInfo').send({
			phone: '+33134567890',
			adminCode: adminPassword,
			area: areaId,
			campaign: campaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			client: {
				name: 'clientInfotest',
				phone: '+33134567890',
				campaigns: [campaignId],
				priority: [{ campaign: campaignId, id: '-1' }]
			},
			call: expect.any(Array)
		});
		expect(res.body.message).toBe('Client info got');
	});
});
