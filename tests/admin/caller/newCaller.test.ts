import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Caller } from '../../../Models/Caller';
dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
let callerId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Caller.deleteMany({});
	await Area.deleteMany({});
	await Caller.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changepassordtest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/createCaller', () => {
	it('should return 400 if invalid pin code', async () => {
		const res = await request(app).post('/admin/caller/createCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '+33223456780',
			pinCode: '123',
			name: 'caller'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Invalid pin code');
	});

	it('should return 400 if wrong phone number', async () => {
		const res = await request(app).post('/admin/caller/createCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '123456789',
			pinCode: '1234',
			name: 'caller'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Wrong phone number');
	});

	it('should return 400 if invalid credentials', async () => {
		const res = await request(app).post('/admin/caller/createCaller').send({
			adminCode: 'wrongCode',
			area: areaId,
			phone: '+33223456780',
			pinCode: '1234',
			name: 'caller'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Invalid credentials');
	});

	it('should return 400 if caller already exist', async () => {
		callerId = (
			await Caller.create({
				name: 'caller',
				password: 'password',
				area: areaId,
				phone: '+33223456780',
				pinCode: '1234'
			})
		)._id;
		const res = await request(app).post('/admin/caller/createCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '+33223456780',
			pinCode: '1234',
			name: 'caller'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'caller already exist');
	});

	it('should return 200 if all parameters are correct', async () => {
		const res = await request(app).post('/admin/caller/createCaller').send({
			adminCode: 'password',
			area: areaId,
			phone: '+33223456781',
			pinCode: '1234',
			name: 'caller'
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'Caller caller (+33223456781) created');
	});
	it('should return 200 if all parameters are correct with hash', async () => {
		const res = await request(app).post('/admin/caller/createCaller').send({
			adminCode: adminPassword,
			area: areaId,
			phone: '+33223456782',
			pinCode: '1234',
			name: 'caller',
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'Caller caller (+33223456782) created');
	});
});
