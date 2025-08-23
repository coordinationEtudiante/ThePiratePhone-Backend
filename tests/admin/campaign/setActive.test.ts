import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';

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
			name: 'getCampaignTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	CampaignId = (
		await Campaign.create({
			name: 'getCampaignTest',
			script: 'getCampaignTest',
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

describe('post on /admin/campaign/setActive', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/setActive').send({
			adminCode: 'wrong',
			area: areaId,
			active: true,
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 404 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/setActive').send({
			adminCode,
			area: areaId,
			active: true,
			campaign: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('Campaign not found');
	});

	it('should return 200 if the campaign is activated with hash', async () => {
		const res = await request(app).post('/admin/campaign/setActive').send({
			adminCode,
			area: areaId,
			active: true,
			campaign: CampaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Campaign activated');
		const campaign = await Campaign.findOne({ _id: { $eq: CampaignId } });
		expect(campaign?.active).toBe(true);
	});

	it('should return 200 if the campaign is deactivated with hash', async () => {
		const res = await request(app).post('/admin/campaign/setActive').send({
			adminCode,
			area: areaId,
			active: false,
			campaign: CampaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Campaign desactivated');
		const campaign = await Campaign.findOne({ _id: { $eq: CampaignId } });
		expect(campaign?.active).toBe(false);
	});

	it('should return 200 if the campaign is activated', async () => {
		const res = await request(app).post('/admin/campaign/setActive').send({
			adminCode: 'password',
			area: areaId,
			active: true,
			campaign: CampaignId
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Campaign activated');
		const campaign = await Campaign.findOne({ _id: { $eq: CampaignId } });
		expect(campaign?.active).toBe(true);
	});

	it('should return 200 if the campaign is deactivated', async () => {
		const res = await request(app).post('/admin/campaign/setActive').send({
			adminCode: 'password',
			area: areaId,
			active: false,
			campaign: CampaignId
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Campaign desactivated');
		const campaign = await Campaign.findOne({ _id: { $eq: CampaignId } });
		expect(campaign?.active).toBe(false);
	});
});
