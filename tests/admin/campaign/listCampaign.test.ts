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
			name: 'listCampaignTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;
	Area.updateOne({ _id: areaId }, { $push: { campaignList: CampaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe(' post on /admin/campaign/listCampaign', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/listCampaign').send({
			adminCode: 'wrong',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 404 if campaign list is empty', async () => {
		const res = await request(app).post('/admin/campaign/listCampaign').send({
			adminCode,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(404);
		expect(res.body.message).toBe('No campaign found');
	});

	it('should return 200 if the campaign list is not empty', async () => {
		const campaignId = (
			await Campaign.create({
				name: 'listCampaignTest',
				script: 'listCampaignTest',
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

		const res = await request(app).post('/admin/campaign/listCampaign').send({
			adminCode: 'password',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.data.campaigns.length).toBe(1);
	});
});
