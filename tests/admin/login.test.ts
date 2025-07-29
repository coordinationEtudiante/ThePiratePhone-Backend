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
let campaignID: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Caller.deleteMany({});
	await Area.deleteMany({});
	await Campaign.deleteMany({});
	await Call.deleteMany({});
	await Client.deleteMany({});
	areaId = (
		await Area.create({
			name: 'loginAdminTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	)._id;

	campaignID = (
		await Campaign.create({
			area: areaId,
			active: true,
			nbMaxCallCampaign: 10,
			script: 'script',
			name: 'campaignTest',
			callPermited: true,
			password: 'password'
		})
	).id;

	await Area.updateOne(
		{
			_id: areaId
		},
		{
			$push: {
				campaignList: campaignID
			}
		}
	);
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/login', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/login').send({ adminCode: 'wrongCode', area: areaId });
		expect(res.status).toBe(401);
		expect(res.body).toEqual({ message: 'Wrong admin code', OK: false });
	});

	it('should return 200 if correct admin code', async () => {
		const res = await request(app).post('/admin/login').send({ adminCode: 'password', area: areaId });
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			message: 'OK',
			data: {
				areaName: 'loginAdminTest',
				actualCampaignId: campaignID,
				actualCampaignName: 'campaignTest',
				actualCampaignMaxCall: 10,
				actualCampaignScript: 'script',
				actualCampaignTimeBetweenCall: 10_800_000,
				actualCampaignCallPermited: true,
				actualCampaignStatus: [
					{ name: 'À rappeler', toRecall: true },
					{ name: 'À retirer', toRecall: false },
					{ name: '[hide] validate by API', toRecall: false }
				]
			},
			OK: true
		});
		expect(res.body.data.actualCampaignCallStart).toBeDefined();
		expect(res.body.data.actualCampaignCallEnd).toBeDefined();
	});
	it('should return 200 if correct admin code with hash', async () => {
		const res = await request(app)
			.post('/admin/login')
			.send({ adminCode: adminPassword, area: areaId, allreadyHaseded: true });
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			message: 'OK',
			data: {
				areaName: 'loginAdminTest',
				actualCampaignId: campaignID,
				actualCampaignName: 'campaignTest',
				actualCampaignMaxCall: 10,
				actualCampaignScript: 'script',
				actualCampaignTimeBetweenCall: 10_800_000,
				actualCampaignCallPermited: true,
				actualCampaignStatus: [
					{ name: 'À rappeler', toRecall: true },
					{ name: 'À retirer', toRecall: false },
					{ name: '[hide] validate by API', toRecall: false }
				]
			},
			OK: true
		});
		expect(res.body.data.actualCampaignCallStart).toBeDefined();
		expect(res.body.data.actualCampaignCallEnd).toBeDefined();
	});
});
