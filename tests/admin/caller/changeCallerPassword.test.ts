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

	await Caller.create({
		name: 'changepassordtest',
		phone: '+33234567890',
		pinCode: '1234',
		area: areaId,
		campaigns: [campaignId]
	});
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/changePassword', () => {
	it('should return 400 if new pin code is not a number', async () => {
		const response = await request(app).post('/admin/caller/changePassword').send({
			adminCode: 'password',
			newPassword: 'a123',
			Callerphone: '+33234567890',
			area: areaId
		});
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({ message: 'Invalid new pin code', OK: false });
	});

	it('should return 400 if new pin code is not 4 digits', async () => {
		const response = await request(app).post('/admin/caller/changePassword').send({
			adminCode: 'password',
			newPassword: '12345',
			Callerphone: '+33234567890',
			area: areaId
		});
		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({ message: 'Invalid new pin code', OK: false });
	});

	it('should return 401 if admin code is wrong', async () => {
		const response = await request(app).post('/admin/caller/changePassword').send({
			adminCode: 'wrongAdminPassword',
			newPassword: '1234',
			Callerphone: '+33234567890',
			area: areaId
		});
		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({ message: 'Wrong admin code', OK: false });
	});

	it('should return 404 if caller not found', async () => {
		const response = await request(app).post('/admin/caller/changePassword').send({
			adminCode: 'password',
			newPassword: '1234',
			Callerphone: '+33234567891',
			area: areaId
		});
		expect(response.status).toBe(404);
		expect(response.body).toMatchObject({ message: 'Caller not found or same password', OK: false });
	});

	it('should return 200 if password changed', async () => {
		const response = await request(app).post('/admin/caller/changePassword').send({
			adminCode: 'password',
			newPassword: '1235',
			Callerphone: '+33234567890',
			area: areaId
		});
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ message: 'Password changed', OK: true });
		const newPassword = (await Caller.findOne({ phone: '+33234567890' }, ['pinCode']))?.pinCode;
		expect(newPassword).toBe('1235');
	});

	it('should return 200 if password changed with hash', async () => {
		const response = await request(app).post('/admin/caller/changePassword').send({
			adminCode: adminPassword,
			newPassword: '1235',
			Callerphone: '+33234567890',
			area: areaId,
			allreadyHashed: true
		});
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ message: 'Password changed', OK: true });
		const newPassword = (await Caller.findOne({ phone: '+33234567890' }, ['pinCode']))?.pinCode;
		expect(newPassword).toBe('1235');
	});
});
