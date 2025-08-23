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
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'addCallerCampaigntest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;

	campaignId = (
		await Campaign.create({
			name: 'changeCampaignPasswordTest',
			script: 'changeCampaignPasswordTest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		})
	).id;

	callerId = (
		await Caller.create({
			name: 'addCallerCampaigntest',
			phone: '+33134567890',
			pinCode: '1234',
			campaigns: [campaignId]
		})
	)?.id;
	await Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/addCallerCampaign', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/caller/addCallerCampaign').send({
			phone: '+33134567890',
			adminCode: 'wrong',
			area: areaId,
			campaign: callerId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});
	it('should return 404 if caller not found', async () => {
		const res = await request(app).post('/admin/caller/addCallerCampaign').send({
			phone: '+33134567891',
			adminCode: adminPassword,
			area: areaId,
			campaign: campaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('Caller not found');
	});

	it('should return 200 if caller already in campaign', async () => {
		await Caller.create({
			name: 'addCallerCampaigntest',
			phone: '+33134567892',
			pinCode: '1234',
			campaigns: [campaignId]
		});
		const res = await request(app).post('/admin/caller/addCallerCampaign').send({
			phone: '+33134567892',
			adminCode: adminPassword,
			area: areaId,
			campaign: campaignId,
			allreadyHashed: true
		});

		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Caller already in campaign');
		const caller = await Caller.findOne({ phone: '+33134567892' });
		expect(caller?.campaigns.length).toBe(1);
	});

	it('should return 200 if OK', async () => {
		const campaignId2 = (
			await Campaign.create({
				name: 'addCallerCampaigntest2',
				script: 'addCallerCampaigntest2',
				active: true,
				area: areaId,
				status: [
					{ name: 'À rappeler', toRecall: true },
					{ name: 'À retirer', toRecall: false }
				],
				password: 'password'
			})
		).id;

		await Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId2 } });

		await Caller.create({
			name: 'addCallerCampaigntest2',
			phone: '+33134567893',
			pinCode: '1234',
			campaigns: [campaignId]
		});

		const res = await request(app).post('/admin/caller/addCallerCampaign').send({
			phone: '+33134567893',
			adminCode: adminPassword,
			area: areaId,
			campaign: campaignId2,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Caller added to campaign');
		const caller = await Caller.findOne({ phone: '+33134567890' });
		expect(caller?.campaigns.length).toBe(1);
	});
});
