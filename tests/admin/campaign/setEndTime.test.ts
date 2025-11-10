import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import app from '../../../index';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let CampaignId: mongoose.Types.ObjectId | undefined;

const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'SetEndTimeTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	CampaignId = (
		await Campaign.create({
			name: 'SetEndTimeTest',
			script: 'SetEndTimeTest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		})
	).id;
	await Area.updateOne({ _id: areaId }, { $push: { campaignList: CampaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/campaign/setEndTime', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/setEndTime').send({
			adminCode: 'wrong',
			area: areaId,
			endTime: new Date(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 404 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/setEndTime').send({
			adminCode,
			area: areaId,
			endTime: new Date(),
			CampaignId: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 400 if the date is invalid', async () => {
		const res = await request(app).post('/admin/campaign/setEndTime').send({
			adminCode,
			area: areaId,
			endTime: '42/42/2042',
			CampaignId: CampaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBeDefined();
	});

	it('should return 200 if date is valid and campaign ID is provided', async () => {
		const res = await request(app).post('/admin/campaign/setEndTime').send({
			adminCode,
			allreadyHashed: true,
			area: areaId,
			endTime: '2025-12-13T00:00:00.000Z',
			CampaignId: CampaignId
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('endTime updated');
		expect(res.body.OK).toBe(true);
		const endTimeValue = await Campaign.findOne({ _id: CampaignId }, ['endTime']);
		expect(endTimeValue?.endTime?.toISOString()).toBe('2025-12-13T00:00:00.000Z');
	});

	it('should return 200 if date is valid and no campaign ID is provided (updates active campaign)', async () => {
		await Campaign.updateOne({ _id: CampaignId }, { active: true });

		const res = await request(app).post('/admin/campaign/setEndTime').send({
			adminCode,
			allreadyHashed: true,
			area: areaId,
			endTime: '2025-12-13T00:00:00.000Z'
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('endTime updated');
		expect(res.body.OK).toBe(true);
		const endTimeValue = await Campaign.findOne({ _id: CampaignId }, ['endTime']);
		expect(endTimeValue?.endTime?.toISOString()).toBe('2025-12-13T00:00:00.000Z');
	});

	it('should return 401 if no active campaign exists and no campaign ID is provided', async () => {
		await Campaign.updateOne({ _id: CampaignId }, { active: false });

		const res = await request(app).post('/admin/campaign/setEndTime').send({
			adminCode,
			allreadyHashed: true,
			area: areaId,
			endTime: '2025-12-13T00:00:00.000Z'
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
		expect(res.body.OK).toBe(false);
	});
});
