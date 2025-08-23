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

describe(' post on /admin/campaign/getCampaign', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/getCampaign').send({
			adminCode: 'wrong',
			area: areaId,
			CampaignId: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 404 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/getCampaign').send({
			adminCode,
			area: areaId,
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('no campaign');
	});

	it('should return 401 if the area id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/getCampaign').send({
			adminCode,
			area: new Types.ObjectId(),
			CampaignId: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 200 if is correct', async () => {
		const res = await request(app).post('/admin/campaign/getCampaign').send({
			adminCode,
			area: areaId,
			CampaignId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		expect(res.body.data.active).toBe(true);
	});

	it('should return 200 if is correct without campaign id', async () => {
		const res = await request(app).post('/admin/campaign/getCampaign').send({
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		expect(res.body.data.active).toBe(true);
	});
});
