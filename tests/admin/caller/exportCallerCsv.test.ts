import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';

dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password
let date;
beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Client.deleteMany({});
	await Caller.deleteMany({});
	await Area.deleteMany({});
	await Call.deleteMany({});
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changepassordtest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;

	const CampaignID = (
		await Campaign.create({
			name: 'changepassordtest',
			script: 'changepassordtest',
			active: true,
			area: areaId,
			password: 'password'
		})
	).id;

	const ClientID = await Client.create({
		name: 'changepassordtest',
		firstname: 'test',
		phone: '+33944567890',
		campaigns: [CampaignID],
		priority: [{ campaign: CampaignID, id: '-1' }]
	});

	const CallerId1 = (
		await Caller.create({
			name: 'changepassordtest',
			phone: '+33034567891',
			pinCode: '1234',
			campaigns: []
		})
	).id;

	const CallerId2 = (
		await Caller.create({
			name: 'changepassordtest',
			phone: '+33034567892',
			pinCode: '1234',
			campaigns: []
		})
	).id;

	const CallerId3 = (
		await Caller.create({
			name: 'changepassordtest',
			phone: '+33034567893',
			pinCode: '1234',
			campaigns: []
		})
	).id;
	date = new Date();

	await Call.create({
		caller: CallerId1,
		client: ClientID,
		campaign: CampaignID,
		satisfaction: 'all good',
		status: true
	});

	await Call.create({
		caller: CallerId2,
		client: ClientID,
		campaign: CampaignID,
		satisfaction: 'all good',
		status: true
	});

	await Call.create({
		caller: CallerId2,
		client: ClientID,
		campaign: CampaignID,
		satisfaction: 'all good',
		status: true
	});

	await Call.create({
		caller: CallerId3,
		client: ClientID,
		campaign: CampaignID,
		satisfaction: 'all good',
		status: true
	});

	await Call.create({
		caller: CallerId3,
		client: ClientID,
		campaign: CampaignID,
		satisfaction: 'all good',
		status: true
	});

	await Call.create({
		caller: CallerId3,
		client: ClientID,
		campaign: CampaignID,
		satisfaction: 'all good',
		status: true
	});
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/caller/exportCallersCsv', () => {
	it('should return 401 if admin code is wrong', async () => {
		const response = await request(app).post('/admin/caller/exportCallersCsv').send({
			adminCode: 'wrongAdminPassword',
			area: areaId
		});
		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({ message: 'Wrong admin code', OK: false });
	});

	it('should return 401 if area is not found', async () => {
		const response = await request(app).post('/admin/caller/exportCallersCsv').send({
			adminCode: 'password',
			area: new mongoose.Types.ObjectId()
		});
		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({ message: 'Wrong admin code', OK: false });
	});

	it('should return 200 if all parameters are correct', async () => {
		const response = await request(app).post('/admin/caller/exportCallersCsv').send({
			adminCode: 'password',
			area: areaId
		});
		const expectedPattern = new RegExp(
			'phone;name;createdAt;nbCall\n' +
				'\\+33034567891;changepassordtest;.*;1\n' +
				'\\+33034567892;changepassordtest;.*;2\n' +
				'\\+33034567893;changepassordtest;.*;3'
		);
		expect(response.text).toMatch(expectedPattern);
	});

	it('should return 200 if all parameters are correct with hash', async () => {
		const response = await request(app).post('/admin/caller/exportCallersCsv').send({
			adminCode: adminPassword,
			area: areaId,
			allreadyHashed: true
		});
		expect(response.status).toBe(200);
		const expectedPattern = new RegExp(
			'phone;name;createdAt;nbCall\n' +
				'\\+33034567891;changepassordtest;.*;1\n' +
				'\\+33034567892;changepassordtest;.*;2\n' +
				'\\+33034567893;changepassordtest;.*;3'
		);
		expect(response.text).toMatch(expectedPattern);
	});
});
