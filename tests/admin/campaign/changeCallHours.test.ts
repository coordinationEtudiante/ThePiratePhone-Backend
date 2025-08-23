import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
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
			name: 'changeCallHoursTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'changeCallHoursTest',
			script: 'changeCallHoursTest',
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

describe('post on /admin/campaign/changeCallHours', () => {
	it('should return 400 if bad start date', async () => {
		const res = await request(app).post('/admin/campaign/changeCallHours').send({
			adminCode: adminCode,
			newEndHours: '2022-10-10T10:00:00.000Z',
			newStartHours: 'bad date',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Invalid start date');
	});

	it('should return 400 if bad end date', async () => {
		const res = await request(app).post('/admin/campaign/changeCallHours').send({
			adminCode: adminCode,
			newEndHours: 'bad date',
			newStartHours: '2022-10-10T10:00:00.000Z',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Invalid end date');
	});

	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/campaign/changeCallHours').send({
			adminCode: 'wrong password',
			newEndHours: '2022-10-10T10:00:00.000Z',
			newStartHours: '2022-10-10T10:00:00.000Z',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 401 if wrong campaign id', async () => {
		const res = await request(app).post('/admin/campaign/changeCallHours').send({
			adminCode: adminCode,
			newEndHours: '2022-10-10T10:00:00.000Z',
			newStartHours: '2022-10-10T10:00:00.000Z',
			area: areaId,
			CampaignId: new Types.ObjectId().toHexString(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 200 if OK with hash', async () => {
		const start = new Date();
		const end = new Date();
		start.setHours(13, 18);
		end.setHours(14, 18);
		const res = await request(app).post('/admin/campaign/changeCallHours').send({
			adminCode: adminCode,
			newStartHours: start,
			newEndHours: end,
			area: areaId,
			CampaignId: campaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.message).toBe('OK');
		const campaign = await Campaign.findById(campaignId);
		expect(campaign?.callHoursStart.toString()).toBe(start.toString());
		expect(campaign?.callHoursEnd.toString()).toBe(end.toString());
	});

	it('should return 200 if OK', async () => {
		const start = new Date();
		const end = new Date();
		start.setHours(14, 18);
		end.setHours(15, 18);
		const res = await request(app).post('/admin/campaign/changeCallHours').send({
			adminCode: 'password',
			newStartHours: start,
			newEndHours: end,
			area: areaId,
			CampaignId: campaignId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.message).toBe('OK');
		const campaign = await Campaign.findById(campaignId);
		expect(campaign?.callHoursStart.toString()).toBe(start.toString());
		expect(campaign?.callHoursEnd.toString()).toBe(end.toString());
	});
});
