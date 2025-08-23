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

describe('post on /admin/caller/searchByName', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/caller/searchByName').send({
			adminCode: 'wrongAdminCode',
			area: areaId,
			name: 'name'
		});
		expect(res.status).toBe(401);
		expect(res.body).toHaveProperty('message', 'Wrong admin code');
	});

	it('should return 200 if OK', async () => {
		await Caller.create({
			name: 'name',
			phone: '+33323456780',
			campaigns: [campaignId],
			pinCode: '1234'
		});
		await Caller.create({
			name: 'name1',
			phone: '+33323456781',
			campaigns: [campaignId],
			pinCode: '1234'
		});
		await Caller.create({
			name: 'chose',
			phone: '+33323456782',
			campaigns: [campaignId],
			pinCode: '1234'
		});

		const res = await request(app).post('/admin/caller/searchByName').send({
			adminCode: 'password',
			area: areaId,
			name: 'name'
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('OK', true);
		expect(res.body).toHaveProperty('data');
		expect(res.body.data).toHaveLength(2);
		expect(res.body.data[0]).toHaveProperty('name', 'name');
		expect(res.body.data[1]).toHaveProperty('name', 'name1');

		const res2 = await request(app).post('/admin/caller/searchByName').send({
			adminCode: 'password',
			area: areaId,
			name: 'chose'
		});
		expect(res2.status).toBe(200);
		expect(res2.body).toHaveProperty('OK', true);
		expect(res2.body).toHaveProperty('data');
		expect(res2.body.data).toHaveLength(1);
		expect(res2.body.data[0]).toHaveProperty('name', 'chose');
	});

	it('should return 200 if OK with hash', async () => {
		await Caller.create({
			name: 'hello',
			phone: '+33323456783',
			campaigns: [campaignId],
			pinCode: '1234'
		});
		await Caller.create({
			name: 'hello1',
			phone: '+33323456784',
			campaigns: [campaignId],
			pinCode: '1234'
		});
		await Caller.create({
			name: 'truc1',
			phone: '+33323456785',
			campaigns: [campaignId],
			pinCode: '1234'
		});

		const res = await request(app).post('/admin/caller/searchByName').send({
			adminCode: adminPassword,
			area: areaId,
			name: 'hello',
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('OK', true);
		expect(res.body).toHaveProperty('data');
		expect(res.body.data).toHaveLength(2);
		expect(res.body.data[0]).toHaveProperty('name', 'hello');
		expect(res.body.data[1]).toHaveProperty('name', 'hello1');

		const res2 = await request(app).post('/admin/caller/searchByName').send({
			adminCode: adminPassword,
			area: areaId,
			name: 'truc',
			allreadyHashed: true
		});
		expect(res2.status).toBe(200);
		expect(res2.body).toHaveProperty('OK', true);
		expect(res2.body).toHaveProperty('data');
		expect(res2.body.data).toHaveLength(1);
		expect(res2.body.data[0]).toHaveProperty('name', 'truc1');
	});
});
