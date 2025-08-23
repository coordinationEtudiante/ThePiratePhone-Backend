import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
import { ObjectId } from 'mongodb';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let clientId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;

const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Client.deleteMany({});
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'callerInfoTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'callerInfoTest',
			script: 'callerInfoTest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		})
	).id;
	Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });

	clientId = (
		await Client.create({
			name: 'callerInfoTest',
			phone: '+33634567890',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		})
	)._id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/campaign/addClientCampaign', () => {
	it('should return 400 if bad phone number', async () => {
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: 'bad phone number',
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body).toEqual({ message: 'Wrong phone number', OK: false });
	});
	it('should return 401 if bad admin code', async () => {
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: '+33634567890',
			adminCode: 'bad admin code',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: 'Wrong admin code', OK: false });
	});
	it('should return 404 if user not found', async () => {
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: '+33634567891',
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body).toEqual({ message: 'User not found', OK: false });
	});
	it('should return 404 if campaign not found', async () => {
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: new Types.ObjectId(),
			phone: '+33634567890',
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body).toEqual({ message: 'Campaign not found', OK: false });
	});

	it('should return 200 if user is already in campaign', async () => {
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: '+33634567890',
			adminCode: 'password',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ message: 'User already in campaign', OK: true });
		const clientCampaign = (await Client.findOne({ phone: '+33634567890' }))?.campaigns ?? [];
		expect(JSON.stringify(clientCampaign[0])).toEqual(JSON.stringify(campaignId));
	});

	it('should return 200 if user is added to campaign', async () => {
		await Client.create({
			name: 'callerInfoTest',
			phone: '+33634567892',
			area: areaId,
			priority: [{ campaign: new ObjectId(), id: '-1' }]
		});
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: '+33634567892',
			adminCode: 'password',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ message: 'User added to campaign', OK: true });
		const clientCampaign = (await Client.findOne({ phone: '+33634567892' }))?.campaigns ?? [];
		expect(JSON.stringify(clientCampaign[0])).toEqual(JSON.stringify(campaignId));
	});

	it('should return 200 if user is already in campaign with hash', async () => {
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: '+33634567890',
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ message: 'User already in campaign', OK: true });
		const clientCampaign = (await Client.findOne({ phone: '+33634567890' }))?.campaigns ?? [];
		expect(JSON.stringify(clientCampaign[0])).toEqual(JSON.stringify(campaignId));
	});

	it('should return 200 if user is added to campaign with hash', async () => {
		await Client.create({
			name: 'callerInfoTest',
			phone: '+33634567893',
			area: areaId,
			priority: [{ campaign: new ObjectId(), id: '-1' }]
		});
		const res = await request(app).post('/admin/campaign/addClientCampaign').send({
			campaign: campaignId,
			phone: '+33634567893',
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ message: 'User added to campaign', OK: true });
		const clientCampaign = (await Client.findOne({ phone: '+33634567893' }))?.campaigns ?? [];
		expect(JSON.stringify(clientCampaign[0])).toEqual(JSON.stringify(campaignId));
	});
});
