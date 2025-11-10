import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../index';
import { Area } from '../../Models/Area';
import { Caller } from '../../Models/Caller';
import { Campaign } from '../../Models/Campaign';
import { Call } from '../../Models/Call';
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
		name: 'getPhoneNumbertest',
		password: 'password',
		campaignList: [],
		adminPassword: 'adminPassword'
	});
	areaId = (await Area.findOne({ name: 'getPhoneNumbertest' }))?._id;
	await Campaign.create({
		name: 'getPhoneNumbertest',
		script: 'getPhoneNumbertest',
		active: true,
		area: areaId,

		status: [
			{ name: 'À rappeler', toRecall: true },
			{ name: 'À retirer', toRecall: false }
		],

		password: 'password'
	});
	campaignId = (await Campaign.findOne({ name: 'getPhoneNumbertest' }))?._id;
	await Caller.create({
		name: 'getPhoneNumbertest',
		phone: '+33734567890',
		pinCode: '1234',
		campaigns: [campaignId]
	});
	await Client.create({
		name: 'getPhoneNumber',
		firstname: 'test',
		phone: '+33712457836',
		area: areaId,
		campaigns: [campaignId],
		priority: [{ campaign: campaignId, id: '-1' }]
	});
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /caller/getPhoneNumber', () => {
	it('should return 400 if phone number is invalid', async () => {
		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: 'invalid', pinCode: '1234', campaign: campaignId });
		expect(res.status).toBe(400);
		expect(res.body).toEqual({ message: 'Invalid phone number', OK: false });
	});

	it('should return 404 if camapaign is not found', async () => {
		await Campaign.create({
			name: 'getPhoneNumber',
			script: 'getPhoneNumber',
			active: false,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		});
		const campaignid = (await Campaign.findOne({ name: 'getPhoneNumber' }))?._id;
		await Caller.create({
			name: 'getPhoneNumber',
			phone: '+33734567899',
			pinCode: '1234',
			campaigns: [campaignid]
		});
		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: '+33734567899', pinCode: '1234', campaign: campaignid });
		expect(res.status).toBe(404);
		expect(res.body).toEqual({ message: 'Campaign not found or not active', OK: false });
	});

	it('should return 403 if call is not permited', async () => {
		await Area.create({
			name: 'getPhoneNumber3',
			password: 'password',
			campaignList: [],
			adminPassword: 'adminPassword'
		});
		const areaId = (await Area.findOne({ name: 'getPhoneNumber3' }))?._id;
		await Campaign.create({
			name: 'getPhoneNumber3',
			script: 'getPhoneNumber3',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password',
			callPermited: false
		});
		const campaignId = (await Campaign.findOne({ name: 'getPhoneNumber3' }))?.id;
		await Caller.create({
			name: 'getPhoneNumber3',
			phone: '+33734567892',
			pinCode: '1234',
			campaigns: [campaignId]
		});

		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: '+33734567892', pinCode: '1234', campaign: campaignId });
		expect(res.status).toBe(403);
		expect(res.body).toEqual({ message: 'Call not permited', OK: false });
	});

	it('should return 200 if alredy in call', async () => {
		const clientId = (await Client.findOne({ phone: '+33712457836' }))?._id;
		await Area.create({
			name: 'getPhoneNumber4',
			password: 'password',
			campaignList: [],
			adminPassword: 'adminPassword'
		});
		const areaId = (await Area.findOne({ name: 'getPhoneNumber4' }))?._id;
		await Campaign.create({
			name: 'getPhoneNumber4',
			script: 'getPhoneNumber4',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password',
			callPermited: true
		});
		const campaignId = (await Campaign.findOne({ name: 'getPhoneNumber4' }))?.id;
		await Caller.create({
			name: 'getPhoneNumber4',
			phone: '+33734567893',
			pinCode: '1234',
			campaigns: [campaignId]
		});
		await Call.create({
			caller: (await Caller.findOne({ phone: '+33734567893' }))?._id,
			client: clientId,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			timeInCall: 1000,
			comment: 'comment'
		});
		await Call.create({
			caller: (await Caller.findOne({ phone: '+33734567893' }))?._id,
			client: clientId,
			campaign: campaignId,
			satisfaction: 'In progress',
			status: true,
			area: areaId
		});
		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: '+33734567893', pinCode: '1234', campaign: campaignId });
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			message: 'Client to call',
			OK: true,
			client: {
				_id: clientId?.toString(),
				name: 'getPhoneNumber',
				firstname: 'test',
				phone: '+33712457836'
			},
			callHistory: [
				{
					comment: 'comment',
					satisfaction: 'Finished',
					status: true
				}
			],
			script: 'getPhoneNumber4',
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			]
		});
	});

	it('should return 404 if no client to call', async () => {
		await Area.create({
			name: 'getPhoneNumber10',
			password: 'password',
			campaignList: [],
			adminPassword: 'adminPassword'
		});
		const areaId = (await Area.findOne({ name: 'getPhoneNumber10' }))?._id;
		await Campaign.create({
			name: 'getPhoneNumber10',
			script: 'getPhoneNumber10',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password',
			callPermited: true
		});
		const campaignId = (await Campaign.findOne({ name: 'getPhoneNumber10' }))?.id;
		await Caller.create({
			name: 'getPhoneNumbertest10',
			phone: '+33734567891',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: '+33734567891', pinCode: '1234', campaign: campaignId });
		expect(res.status).toBe(404);
		expect(res.body).toEqual({ message: 'No client to call', OK: false });
	});

	it('should return 404 if client is call to recently', async () => {
		await Area.create({
			name: 'getPhoneNumber11',
			password: 'password',
			campaignList: [],
			adminPassword: 'adminPassword'
		});
		const areaId = (await Area.findOne({ name: 'getPhoneNumber11' }))?._id;
		await Campaign.create({
			name: 'getPhoneNumber11',
			script: 'getPhoneNumber11',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password',
			callPermited: true
		});
		const campaignId = (await Campaign.findOne({ name: 'getPhoneNumber11' }))?.id;
		await Client.create({
			name: 'getPhoneNumber2',
			firstname: 'test',
			phone: '+33712457837',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Caller.create({
			name: 'getPhoneNumber5',
			phone: '+33734567894',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Call.create({
			caller: (await Caller.findOne({ phone: '+33734567894' }))?._id,
			client: (await Client.findOne({ phone: '+33712457837' }))?._id,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			duration: 1000,
			start: new Date()
		});
		await Caller.create({
			name: 'getPhoneNumbertest10',
			phone: '+33734567900',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: '+33734567900', pinCode: '1234', campaign: campaignId });
		expect(res.status).toBe(404);
		expect(res.body).toEqual({ message: 'No client to call', OK: false });
	});

	it('should return 200 for recal client', async () => {
		await Area.create({
			name: 'getPhoneNumber11',
			password: 'password',
			campaignList: [],
			adminPassword: 'adminPassword'
		});
		const areaId = (await Area.findOne({ name: 'getPhoneNumber11' }))?._id;
		await Campaign.create({
			name: 'getPhoneNumber11',
			script: 'getPhoneNumber11',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password',
			callPermited: true
		});
		const campaignId = (await Campaign.findOne({ name: 'getPhoneNumber11' }))?.id;
		await Client.create({
			name: 'getPhoneNumber3',
			firstname: 'test',
			phone: '+33712457838',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Caller.create({
			name: 'getPhoneNumber6',
			phone: '+33734567895',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Call.create({
			caller: (await Caller.findOne({ phone: '+33734567895' }))?._id,
			client: (await Client.findOne({ phone: '+33712457838' }))?._id,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			duration: 1000,
			start: new Date(Date.now() - 10_800_001)
		});
		const res = await request(app)
			.post('/caller/getPhoneNumber')
			.send({ phone: '+33734567895', pinCode: '1234', campaign: campaignId });
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			message: 'Client to call',
			OK: true,
			client: {
				name: 'getPhoneNumber3',
				firstname: 'test',
				phone: '+33712457838'
			}
		});
		await Client.deleteMany({});
		await Call.deleteMany({});
	});

	it('should return 404 if client is call to much', async () => {
		await Client.create({
			name: 'getPhoneNumber4',
			firstname: 'test',
			phone: '+33712457839',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Caller.create({
			name: 'getPhoneNumber7',
			phone: '+33734567896',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		const caller = (await Caller.findOne({ phone: '+33734567896' }))?._id;
		const client = (await Client.findOne({ phone: '+33712457839' }))?._id;

		await Call.create({
			caller,
			client,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			duration: 1000,
			start: new Date(Date.now() - 10_800_001)
		});
		await Call.create({
			caller,
			client,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			duration: 1000,
			start: new Date(Date.now() - 10_800_001)
		});
		await Call.create({
			caller,
			client,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			duration: 1000,
			start: new Date(Date.now() - 10_800_001)
		});
		await Call.create({
			caller,
			client,
			campaign: campaignId,
			satisfaction: 'Finished',
			status: true,
			area: areaId,
			duration: 1000,
			start: new Date(Date.now() - 10_800_001)
		});
		const res = await request(app).post('/caller/getPhoneNumber').send({
			phone: '+33734567890',
			pinCode: '1234',
			campaign: campaignId
		});
		expect(res.status).toBe(404);
		expect(res.body).toEqual({ message: 'No client to call', OK: false });
	});

	it('should work', async () => {
		await Client.create({
			name: 'getPhoneNumber6',
			firstname: 'test',
			phone: '+33712457841',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Caller.create({
			name: 'getPhoneNumber9',
			phone: '+33734567898',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		const res = await request(app).post('/caller/getPhoneNumber').send({
			phone: '+33734567898',
			pinCode: '1234',
			campaign: campaignId
		});
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			message: 'Client to call',
			OK: true,
			client: {
				name: 'getPhoneNumber6',
				firstname: 'test',
				phone: '+33712457841'
			}
		});
	});

	it('should work with priority', async () => {
		await Client.create({
			name: 'getPhoneNumber7',
			firstname: 'test',
			phone: '+33712457842',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		await Client.create({
			name: 'getPhoneNumber8',
			firstname: 'test',
			phone: '+33712457843',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: 'md4rye5b' }]
		});
		await Caller.create({
			name: 'getPhoneNumber10',
			phone: '+33734567999',
			pinCode: '1234',
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});
		const res = await request(app).post('/caller/getPhoneNumber').send({
			phone: '+33734567999',
			pinCode: '1234',
			campaign: campaignId
		});
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			message: 'Client to call',
			OK: true,
			client: {
				name: 'getPhoneNumber8',
				firstname: 'test',
				phone: '+33712457843'
			}
		});
	});

	it('should return 403 if endTime is passed', async () => {
		const campaignId = (
			await Campaign.create({
				name: 'getPhoneNumber12',
				script: 'getPhoneNumber12',
				active: true,
				area: areaId,
				status: [
					{ name: 'À rappeler', toRecall: true },
					{ name: 'À retirer', toRecall: false }
				],
				password: 'password',
				callPermited: true,
				endTime: new Date(0)
			})
		)?.id;

		await Client.create({
			name: 'getPhoneNumber9',
			firstname: 'test',
			phone: '+33712457844',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		});

		await Caller.create({
			name: 'getPhoneNumber13',
			phone: '+33834567800',
			pinCode: '1234',
			campaigns: [campaignId]
		});

		const res = await request(app).post('/caller/getPhoneNumber').send({
			phone: '+33834567800',
			pinCode: '1234',
			campaign: campaignId
		});

		expect(res.status).toBe(403);
		expect(res.body.message).toBe('Call not permited, the end time has passed');
	});
});
