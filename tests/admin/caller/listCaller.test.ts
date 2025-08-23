import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';

dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
let callerId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Caller.deleteMany({});
	await Area.deleteMany({});
	await Caller.deleteMany({});
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changepassordtest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;

	campaignId = (
		await Campaign.create({
			name: 'test',
			area: areaId,
			password: 'password',
			enabled: true,
			nbMaxCallCampaign: 4,
			timeBetweenCall: 10_800_000,
			callHoursStart: new Date(0),
			callHoursEnd: new Date(0),
			callPermited: true
		})
	)._id;

	await Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/listCaller', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/caller/listCaller').send({
			adminCode: 'wrongCode',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body).toHaveProperty('message', 'Wrong admin code');
	});

	it('should return 404 if no caller found', async () => {
		const res = await request(app).post('/admin/caller/listCaller').send({
			adminCode: 'password',
			area: areaId
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'No caller found');
	});

	it('should return 200 if caller found', async () => {
		callerId = (
			await Caller.create({
				name: 'caller',
				password: 'password',
				campaigns: [campaignId],
				phone: '+33123456789',
				pinCode: '1234'
			})
		)._id;
		const res = await request(app).post('/admin/caller/listCaller').send({
			adminCode: 'password',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		expect(res.body.OK).toBe(true);
		expect(res.body.data.callers).toBeInstanceOf(Array);
		expect(res.body.data.numberOfCallers).toBe(1);
	});

	it('should return 200 if caller found with hash', async () => {
		const areaId2 = (
			await Area.create({
				name: 'changepassordtest',
				password: 'password',
				campaignList: [campaignId],
				adminPassword: adminPassword
			})
		)._id;
		await Caller.create({
			name: 'caller',
			password: 'password',
			campaigns: [campaignId],
			phone: '+33123456790',
			pinCode: '1234'
		});
		const res = await request(app).post('/admin/caller/listCaller').send({
			adminCode: adminPassword,
			area: areaId2,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		expect(res.body.OK).toBe(true);
		expect(res.body.data.callers).toBeInstanceOf(Array);
		expect(res.body.data.numberOfCallers).toBe(2);
	});
});
