import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let callerId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;

const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86';

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Caller.deleteMany({});
	await Campaign.deleteMany({});
	await Call.deleteMany({});

	const area = await Area.create({
		name: 'callerInfoTest',
		password: 'password',
		campaignList: [],
		adminPassword: adminCode
	});
	areaId = area._id;

	const campaign = await Campaign.create({
		name: 'callerInfoTest',
		script: 'callerInfoTest',
		active: true,
		area: areaId,

		status: [
			{ name: 'À rappeler', toRecall: true },
			{ name: 'À retirer', toRecall: false }
		],

		password: 'password'
	});
	campaignId = campaign._id;
	await Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });

	const caller = await Caller.create({
		name: 'callerInfoTest',
		phone: '+33634567890',
		pinCode: '1234',
		campaigns: [campaignId]
	});
	callerId = caller._id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/callerInfo', () => {
	it('should return 400 if bad phone number', async () => {
		const res = await request(app).post('/admin/caller/callerInfo').send({
			adminCode: adminCode,
			phone: 'invalid',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'Wrong phone number');
	});

	it('should return 404 if area not found', async () => {
		const res = await request(app).post('/admin/caller/callerInfo').send({
			adminCode: adminCode,
			phone: '+33634567890',
			area: new mongoose.Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no area found');
	});

	it('should return 404 if caller not found', async () => {
		const res = await request(app).post('/admin/caller/callerInfo').send({
			adminCode: adminCode,
			phone: '+33634567891',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no caller found');
	});

	it('should return 404 if campaign not found', async () => {
		const Area2Id = (
			await Area.create({
				name: 'callerInfoTest2',
				password: 'password',
				campaignList: [],
				adminPassword: adminCode
			})
		).id;
		const Campaign2Id = (
			await Campaign.create({
				name: 'callerInfoTest2',
				script: 'callerInfoTest2',
				active: false,
				area: Area2Id,
				status: [
					{ name: 'À rappeler', toRecall: true },
					{ name: 'À retirer', toRecall: false }
				],
				password: 'password'
			})
		).id;
		await Area.updateOne({ _id: Area2Id }, { $push: { campaignList: Campaign2Id } });
		const Caller2Id = (
			await Caller.create({
				name: 'callerInfoTest',
				phone: '+33634567892',
				pinCode: '1234',
				campaigns: [Campaign2Id]
			})
		).id;
		const res = await request(app).post('/admin/caller/callerInfo').send({
			adminCode: adminCode,
			phone: '+33634567892',
			area: Area2Id,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no campaign active');
	});

	it('should return 200 with caller info', async () => {
		const res = await request(app).post('/admin/caller/callerInfo').send({
			adminCode: adminCode,
			phone: '+33634567890',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		const reg = new RegExp(`{
      message: 'OK',
      OK: true,
      data: {
        id: '${callerId}',
        name: 'callerInfoTest',
        phone: '+33634567890',
		rank: 1
      }
    }`);
		expect(res.body).toMatchObject(reg);
	});
});
