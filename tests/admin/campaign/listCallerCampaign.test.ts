import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';
import { Caller } from '../../../Models/Caller';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let CampaignId: mongoose.Types.ObjectId | undefined;

const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Campaign.deleteMany({});
	await Caller.deleteMany({});

	areaId = (
		await Area.create({
			name: 'listCallerCampaignTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	CampaignId = (
		await Campaign.create({
			name: 'listCallerCampaignTest',
			script: 'listCallerCampaignTest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		})
	).id;
	Area.updateOne({ _id: areaId }, { $push: { campaignList: CampaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe(' post on /admin/campaign/listCallerCampaign', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/listCallerCampaign').send({
			adminCode: 'wrong',
			area: areaId,
			CampaignId: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 404 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/listCallerCampaign').send({
			adminCode,
			area: areaId,
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 404 if no caller in the campaign', async () => {
		const res = await request(app).post('/admin/campaign/listCallerCampaign').send({
			adminCode,
			area: areaId,
			CampaignId: CampaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('No callers found');
	});

	it('should return 200 if OK with hash', async () => {
		await Caller.create({
			name: 'name',
			phone: '+33693456780',
			area: areaId,
			pinCode: '1234',
			campaigns: [CampaignId]
		});
		await Caller.create({
			name: 'name1',
			phone: '+33693456781',
			area: areaId,
			pinCode: '1234',
			campaigns: [CampaignId]
		});
		await Caller.create({
			name: 'name2',
			phone: '+33693456782',
			area: areaId,
			pinCode: '1234',
			campaigns: [CampaignId]
		});
		const res = await request(app).post('/admin/campaign/listCallerCampaign').send({
			adminCode,
			area: areaId,
			CampaignId: CampaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'OK');
		expect(res.body).toHaveProperty('OK', true);
		expect(res.body).toHaveProperty('data');
		expect(res.body.data.callers.length).toBe(3);
		expect(res.body.data.callers[0]).toHaveProperty('phone', '+33693456780');
	});
});
