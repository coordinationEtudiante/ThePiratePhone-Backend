import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
let clientId: mongoose.Types.ObjectId | undefined;
const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Client.deleteMany({});

	areaId = (
		await Area.create({
			name: 'searchCompleteTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'searchCompleteTest',
			script: 'searchCompleteTest',
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
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		})
	).id;
	await Client.create({
		name: 'other',
		phone: '+33134567891',
		area: areaId,
		campaigns: [campaignId],
		priority: [{ campaign: campaignId, id: '-1' }]
	});
	Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/client/searchComplete', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode: 'wrongPassword',
			name: 'searchCompleteTest',
			firstName: 'searchCompleteTest',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should works', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZRAIKA',
			firstName: 'Romane',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with phoneStart', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZRAIKA',
			firstName: 'Romane',
			phoneStart: '+3313',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with phoneEnd', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZRAIKA',
			firstName: 'Romane',
			phoneEnd: '90',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with phoneStart and phoneEnd', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZRAIKA',
			firstName: 'Romane',
			phoneStart: '+3313',
			phoneEnd: '90',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with invalid case', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZrAiKa',
			firstName: 'rOmAnE',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with invalid case and phone', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZrAiKa',
			firstName: 'rOmAnE',
			phoneStart: '+3313',
			phoneEnd: '90',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with phoneStart and phoneEnd second pass', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZAIKA',
			firstName: 'Romane',
			phoneStart: '+3313',
			phoneEnd: '90',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with second pass', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZAIKA',
			firstName: 'Romane',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should works with invalid case second pass', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'ZAiKa',
			firstName: 'rOmAnE',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data).toMatchObject({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890'
		});
	});

	it('should return 404 if no client found', async () => {
		const res = await request(app).post('/admin/client/searchComplete').send({
			adminCode,
			allreadyHashed: true,
			name: 'searchCompleteTest',
			firstName: 'searchCompleteTest',
			area: areaId
		});
		expect(res.status).toBe(404);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('no client found');
	});
});
