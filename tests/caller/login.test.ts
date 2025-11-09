import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../index';
import { Area } from '../../Models/Area';
import { Call } from '../../Models/Call';
import { Caller } from '../../Models/Caller';
import { Campaign } from '../../Models/Campaign';
import { Client } from '../../Models/Client';

dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Caller.deleteMany({});
	await Area.deleteMany({});
	await Campaign.deleteMany({});
	await Call.deleteMany({});
	await Client.deleteMany({});
	await Area.create({
		name: 'loginTest',
		password: 'password',
		campaignList: [],
		adminPassword: 'adminPassword'
	});
	areaId = (await Area.findOne({ name: 'loginTest' }))?._id;
	await Campaign.create({
		name: 'loginTest',
		script: 'loginTest',
		active: true,
		area: areaId,
		status: [
			{ name: 'À rappeler', toRecall: true },
			{ name: 'À retirer', toRecall: false }
		],
		password: 'password',
		endTime: new Date()
	});
	campaignId = (await Campaign.findOne({ name: 'loginTest' }))?._id;
	await Caller.create({
		name: 'loginTest',
		phone: '+33434567901',
		pinCode: '1234',
		area: areaId,
		campaigns: campaignId
	});
});

afterAll(async () => {
	await mongoose.connection.close();
});
describe('post on /caller/login', () => {
	it('should return 400 if phone is invalid', async () => {
		const res = await request(app).post('/caller/login').send({
			phone: 'invalid',
			pinCode: '1234'
		});
		expect(res.status).toBe(400);
		expect(res.body.OK).toBe(false);
	});
	it('should return 403 if credential is invalid', async () => {
		const res = await request(app).post('/caller/login').send({
			phone: '+33434567901',
			pinCode: '1235'
		});
		expect(res.status).toBe(403);
		expect(res.body.OK).toBe(false);
	});
	it('should return 500 if no area is found', async () => {
		const fakeAreaID = new mongoose.Types.ObjectId();
		const campaignID2 = (
			await Campaign.create({
				name: 'loginTest2',
				script: 'loginTest2',
				active: true,
				area: fakeAreaID,
				status: [
					{ name: 'À rappeler', toRecall: true },
					{ name: 'À retirer', toRecall: false }
				],
				password: 'password'
			})
		)?._id;
		const Ncaller = (
			await Caller.create({
				name: 'loginTest2',
				phone: '+33434567902',
				pinCode: '1234',
				campaigns: campaignID2
			})
		)?._id;
		const res = await request(app).post('/caller/login').send({
			phone: '+33434567902',
			pinCode: '1234'
		});
		expect(res.status).toBe(500);
		expect(res.body.OK).toBe(false);
	});

	it('should return 200 if all is correct', async () => {
		const res = await request(app).post('/caller/login').send({
			phone: '+33434567901',
			pinCode: '1234'
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.data.caller.name).toBe('loginTest');
		expect(res.body.data.caller.phone).toBe('+33434567901');
		expect(res.body.data.campaignAvailable.length).toBe(1);
		expect(res.body.data.campaignAvailable[0].endTime).toBeDefined();
		expect(res.body.data.campaignAvailable[0].name).toBe('loginTest');
		expect(res.body.data.campaignAvailable[0].callHoursStart).toBeDefined();
		expect(res.body.data.campaignAvailable[0].callHoursEnd).toBeDefined();
		expect(res.body.data.campaignAvailable[0].areaId).toBeDefined();
		expect(res.body.data.campaignAvailable[0].areaName).toBe('loginTest');
		expect(res.body.data.campaignAvailable[0].status).toMatchObject([
			{ name: 'À rappeler', toRecall: true },
			{ name: 'À retirer', toRecall: false }
		]);
		expect(res.body.data.campaignAvailable[0]._id).toBeDefined();
		expect(res.body.data.campaignAvailable[0].areaId).toBeDefined();
		expect(res.body.data.campaignAvailable[0].areaId.toString()).toBe(areaId?.toString());
		expect(res.body.data.campaignAvailable[0]._id.toString()).toBe(campaignId?.toString());
	});
});
