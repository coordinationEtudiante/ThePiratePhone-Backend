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
			active: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			password: 'password'
		})
	)._id;
	await Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });

	callerId = (
		await Caller.create({
			name: 'changepassordtest',
			phone: '+33134567890',
			pinCode: '1234',
			area: areaId,
			campaigns: [campaignId]
		})
	)?.id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/changeName', () => {
	it('should return 400 if newName is empty', async () => {
		const response = await request(app).post('/admin/caller/changeName').send({
			adminCode: 'password',
			newName: '',
			phone: '+33134567890',
			area: areaId
		});
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({ message: 'Wrong newName', OK: false });
	});

	it('should return 401 if admin code is wrong', async () => {
		const response = await request(app).post('/admin/caller/changeName').send({
			adminCode: 'wrongpassword',
			newName: 'newName',
			phone: '+33134567890',
			area: areaId
		});
		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({ message: 'Wrong admin code', OK: false });
	});

	it('should return 400 if caller not found', async () => {
		const response = await request(app).post('/admin/caller/changeName').send({
			adminCode: 'password',
			newName: 'newName',
			phone: '+33134567891',
			area: areaId
		});
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({ message: 'Caller not found', OK: false });
	});

	it('should return 200 if all parameters are correct', async () => {
		const response = await request(app).post('/admin/caller/changeName').send({
			adminCode: 'password',
			newName: 'newName',
			phone: '+33134567890',
			area: areaId
		});
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ message: 'Caller name changed', OK: true });
	});
	it('should return 200 if all parameters are correct with hash', async () => {
		const response = await request(app).post('/admin/caller/changeName').send({
			adminCode: adminPassword,
			newName: 'newName',
			phone: '+33134567890',
			area: areaId,
			allreadyHashed: true
		});
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ message: 'Caller name changed', OK: true });
	});
});
