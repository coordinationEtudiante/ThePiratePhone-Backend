import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password
beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changepassordtest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword,
			adminPhone: [
				['+33600000000', 'Test Admin'],
				['+33611111111', 'Test Admin 2']
			]
		})
	).id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/area/smsStatus', () => {
	it('should return 200 and sms status when valid data is provided', async () => {
		const response = await request(app).post('/admin/area/smsStatus').send({
			adminCode: 'password',
			area: areaId?.toString(),
			allreadyHashed: true
		});

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('OK', true);
		expect(response.body.data).toHaveProperty('service');
		expect(response.body.data).toHaveProperty('enabled');
		expect(response.body.data).toHaveProperty('adminPhone');
	});

	it('should return 404 when password is bad', async () => {
		const response = await request(app).post('/admin/area/smsStatus').send({
			adminCode: 'bad',
			area: areaId?.toString(),
			allreadyHashed: true
		});

		expect(response.status).toBe(404);
		expect(response.body).toHaveProperty('OK', false);
		expect(response.body).toHaveProperty('message', 'no area found');
	});

	//on this test we dont test the sms service, so we dont need to emulate the sms service
	it('should return 200 and sms status with super admin phone when valid data is provided', async () => {
		const response = await request(app).post('/admin/area/smsStatus').send({
			adminCode: 'password',
			area: areaId?.toString(),
			allreadyHashed: true
		});

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('OK', true);
		expect(response.body.data.adminPhone).toContainEqual([
			process.env.SUPERADMIN_PHONE ?? '+33700000000',
			'Super Admin'
		]);
		expect(response.body.data.adminPhone).toContainEqual(['+33600000000', 'Test Admin']);
		expect(response.body.data.adminPhone).toContainEqual(['+33611111111', 'Test Admin 2']);
	});
});
