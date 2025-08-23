import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';

dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Caller.deleteMany({});
	await Area.deleteMany({});
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
			active: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			password: 'password'
		})
	)._id;
	await Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/removeCaller', () => {
	it('should return 400 if wrong phone number', async () => {
		const res = await request(app).post('/admin/caller/removeCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '123456789'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Wrong phone number');
	});

	it('should return 400 if invalid area', async () => {
		const res = await request(app).post('/admin/caller/removeCaller').send({
			adminCode: 'password',
			area: new mongoose.Types.ObjectId(),
			phone: '+33223456780'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Invalid area');
	});

	it('should return 400 if caller not found', async () => {
		const res = await request(app).post('/admin/caller/removeCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '+33223456780'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Caller not found');
	});

	it('should return 200 if caller removed', async () => {
		await Caller.create({
			phone: '+33223456780',
			campaigns: [campaignId],
			name: 'caller',
			pinCode: '1234'
		});
		const res = await request(app).post('/admin/caller/removeCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '+33223456780'
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'Caller removed');
	});

	it('should return 200 if caller removed with hash', async () => {
		await Caller.create({
			phone: '+33223456781',
			campaigns: [campaignId],
			name: 'caller',
			pinCode: '1234'
		});
		const res = await request(app).post('/admin/caller/removeCaller').send({
			adminCode: adminPassword,
			area: areaId,
			phone: '+33223456781',
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'Caller removed');
	});
});
