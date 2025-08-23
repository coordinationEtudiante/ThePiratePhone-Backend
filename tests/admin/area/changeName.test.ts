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
			adminPassword: adminPassword
		})
	).id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/area/changeName', () => {
	it('should return 400 if bad new name', async () => {
		const res = await request(app).post('/admin/area/changeName').send({
			adminCode: adminPassword,
			area: areaId,
			newName: ' ',
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'bad new name');
	});

	it('should return 400 if new name is too long', async () => {
		const res = await request(app)
			.post('/admin/area/changeName')
			.send({
				adminCode: adminPassword,
				area: areaId,
				newName: 'a'.repeat(51),
				allreadyHashed: true
			});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'bad new name');
	});

	it('should return 404 if no area found', async () => {
		const res = await request(app).post('/admin/area/changeName').send({
			adminCode: adminPassword,
			area: new mongoose.Types.ObjectId(),
			newName: 'newName',
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no area found');
	});

	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/area/changeName').send({
			adminCode: 'wrongpassword',
			area: areaId,
			newName: 'newName'
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no area found');
	});

	it('should return 200 if name of area changed', async () => {
		const res = await request(app).post('/admin/area/changeName').send({
			adminCode: 'password',
			area: areaId,
			newName: 'newName'
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'name of area changed');
		const newName = (await Area.findById(areaId))?.name;
		expect(newName).toBe('newName');
	});

	it('should return 200 if name of area changed with hash', async () => {
		const res = await request(app).post('/admin/area/changeName').send({
			adminCode: adminPassword,
			area: areaId,
			newName: 'newName2',
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'name of area changed');
		const newName = (await Area.findById(areaId))?.name;
		expect(newName).toBe('newName2');
	});
});
