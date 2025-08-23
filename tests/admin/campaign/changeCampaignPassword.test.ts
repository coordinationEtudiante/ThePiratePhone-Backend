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
			name: 'changeCampaignPasswordTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'changeCampaignPasswordTest',
			script: 'changeCampaignPasswordTest',
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

describe('post on /admin/campaign/changePassword', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/campaign/changePassword').send({
			adminCode: 'wrong code',
			newCampaignCode: 'new password',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 401 if wrong campaign id', async () => {
		const res = await request(app).post('/admin/campaign/changePassword').send({
			adminCode,
			newCampaignCode: 'new password',
			area: areaId,
			CampaignId: new Types.ObjectId().toHexString(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 400 if new password invalid', async () => {
		const res = await request(app).post('/admin/campaign/changePassword').send({
			adminCode,
			newCampaignCode: '{$ne: null}',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('New password invalid');
	});

	it('should return 200 if OK', async () => {
		const res = await request(app).post('/admin/campaign/changePassword').send({
			adminCode: 'password',
			newCampaignCode: 'new password',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		const campaignPassword = await Campaign.findOne({ _id: campaignId });
		expect(campaignPassword?.password).toBe('new password');
	});

	it('should return 200 if OK with hash', async () => {
		const res = await request(app).post('/admin/campaign/changePassword').send({
			adminCode,
			newCampaignCode: 'new password2',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		const campaignPassword = await Campaign.findOne({ _id: campaignId });
		expect(campaignPassword?.password).toBe('new password2');
	});
});
