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
			name: 'createClienttest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;

	callerId = (
		await Caller.create({
			name: 'createClienttest',
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
			name: 'createClienttest',
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

describe('post on /admin/client/createClient', () => {
	it('should return 401 if admin code is wrong', async () => {
		const res = await request(app).post('/admin/client/createClient').send({
			phone: '+33134567890',
			name: 'createClienttest',
			adminCode: 'wrong',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 400 if phone number is wrong', async () => {
		const res = await request(app).post('/admin/client/createClient').send({
			phone: 'wrong',
			name: 'createClienttest',
			adminCode: adminPassword,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Wrong phone number');
	});

	it('should return 422 if user already exist', async () => {
		const res = await request(app).post('/admin/client/createClient').send({
			phone: '+33134567890',
			name: 'createClienttest',
			adminCode: adminPassword,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(422);
		expect(res.body.message).toBe('User already exist');
	});

	it('should return 200 if OK', async () => {
		const res = await request(app).post('/admin/client/createClient').send({
			phone: '+33134567891',
			name: 'createClienttest',
			adminCode: adminPassword,
			firstName: 'createClienttest',
			institution: 'createClienttest',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		const client = await Client.findOne({ phone: '+33134567891' });
		expect(client).not.toBeNull();
	});

	it('should return 200 with priority', async () => {
		const res = await request(app)
			.post('/admin/client/createClient')
			.send({
				phone: '+33134567892',
				name: 'createClienttest2',
				adminCode: adminPassword,
				firstName: 'createClienttest2',
				institution: 'createClienttest2',
				area: areaId,
				allreadyHashed: true,
				priority: [{ campaign: campaignId, id: 'md4rye5b' }]
			});
		expect(res.status).toBe(200);
		const client = await Client.findOne({ phone: '+33134567892' });
		expect(client).not.toBeNull();
	});

	it('should return 200 if updating existing client', async () => {
		const res = await request(app).post('/admin/client/createClient').send({
			phone: '+33134567890',
			name: 'createClienttestUpdated',
			adminCode: adminPassword,
			firstName: 'createClienttestUpdated',
			institution: 'createClienttestUpdated',
			area: areaId,
			allreadyHashed: true,
			updateKey: clientId,
			updateIfExist: true
		});
		expect(res.status).toBe(200);
		const client = await Client.findOne({ phone: '+33134567890' });
		expect(client?.name).toBe('createClienttestUpdated');
		expect(client?.firstname).toBe('createClienttestUpdated');
		expect(client?.institution).toBe('createClienttestUpdated');
	});

	it('should return 200 if updating existing client but change phone', async () => {
		const res = await request(app).post('/admin/client/createClient').send({
			phone: '+33134567893',
			name: 'createClienttestUpdated',
			adminCode: adminPassword,
			firstName: 'createClienttestUpdated',
			institution: 'createClienttestUpdated',
			area: areaId,
			allreadyHashed: true,
			updateKey: clientId,
			updateIfExist: true
		});
		expect(res.status).toBe(200);
		const client = await Client.findOne({ phone: '+33134567890' });
		expect(client?.name).toBe('createClienttestUpdated');
		expect(client?.firstname).toBe('createClienttestUpdated');
		expect(client?.institution).toBe('createClienttestUpdated');
	});
});
