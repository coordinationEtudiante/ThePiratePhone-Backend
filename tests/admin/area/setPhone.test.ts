import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; // hashed password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});

	areaId = (
		await Area.create({
			name: 'setPhoneTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword,
			adminPhone: []
		})
	).id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('POST /admin/area/setPhone', () => {
	it('should return 400 if phone is not an array', async () => {
		const res = await request(app).post('/admin/area/setPhone').send({
			adminCode: adminPassword,
			area: areaId,
			phone: 'invalidPhone'
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Invalid phone, phone must be a array<[phone, name]>');
		expect(res.body).toHaveProperty('OK', false);
	});

	it('should return 400 if phone number is invalid', async () => {
		const res = await request(app)
			.post('/admin/area/setPhone')
			.send({
				adminCode: adminPassword,
				area: areaId,
				phone: [['invalidPhone', 'John']]
			});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Invalid phone number');
		expect(res.body).toHaveProperty('OK', false);
	});

	it('should return 400 if phone number is an empty array', async () => {
		const res = await request(app).post('/admin/area/setPhone').send({
			adminCode: adminPassword,
			area: areaId,
			phone: []
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Invalid phone, phone must be a array<[phone, name]>');
		expect(res.body).toHaveProperty('OK', false);
	});

	it('should return 404 if no area is found', async () => {
		const res = await request(app)
			.post('/admin/area/setPhone')
			.send({
				adminCode: adminPassword,
				area: new mongoose.Types.ObjectId(),
				phone: [['0701234567', 'John']]
			});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no area found, or bad password');
		expect(res.body).toHaveProperty('OK', false);
	});

	it('should return 404 if password is incorrect', async () => {
		const res = await request(app)
			.post('/admin/area/setPhone')
			.send({
				adminCode: 'wrongPassword',
				area: areaId,
				phone: [['0701234567', 'John']]
			});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no area found, or bad password');
		expect(res.body).toHaveProperty('OK', false);
	});

	it('should return 200 and update admin phone number successfully', async () => {
		const res = await request(app)
			.post('/admin/area/setPhone')
			.send({
				adminCode: adminPassword,
				area: areaId,
				phone: [['0701234567', 'John']],
				allreadyHashed: true
			});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('OK', true);
		expect(res.body).toHaveProperty('message', 'admin phone number updated');

		const updatedArea = await Area.findById(areaId);
		expect(updatedArea?.adminPhone).toEqual([['+33701234567', 'John']]);
	});
});
