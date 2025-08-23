import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;

const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changeTimeBetwenCallTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'changeTimeBetwenCallTest',
			script: 'changeTimeBetwenCallTest',
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
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/campaign/changeTimeBetwenCall', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/changeTimeBetwenCall').send({
			adminCode: 'wrong',
			newTimeBetweenCall: 5,
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 401 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/changeTimeBetwenCall').send({
			adminCode,
			newTimeBetweenCall: 5,
			area: areaId,
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 400 if the time between call is invalid', async () => {
		const res = await request(app).post('/admin/campaign/changeTimeBetwenCall').send({
			adminCode,
			newTimeBetweenCall: 40,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Invalid time between call');
	});
	it('should return 200 if the time between call is changed', async () => {
		const res = await request(app).post('/admin/campaign/changeTimeBetwenCall').send({
			adminCode: 'password',
			newTimeBetweenCall: 60_000,
			area: areaId
		});
		expect(res.status).toBe(200);
		const newTimeBetweenCall = (await Campaign.findOne({ _id: campaignId }))?.timeBetweenCall;
		expect(newTimeBetweenCall).toBe(60_000);
	});
	it('should return 200 if the time between call is changed wirh hash', async () => {
		const res = await request(app).post('/admin/campaign/changeTimeBetwenCall').send({
			adminCode,
			newTimeBetweenCall: 60_000,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		const newTimeBetweenCall = (await Campaign.findOne({ _id: campaignId }))?.timeBetweenCall;
		expect(newTimeBetweenCall).toBe(60_000);
	});
});
