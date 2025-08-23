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
			name: 'changeNumberMaxCallTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'changeNumberMaxCallTest',
			script: 'changeNumberMaxCallTest',
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

describe('post on /admin/campaign/changeNumberMaxCall', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/changeNumberMaxCall').send({
			adminCode: 'wrong',
			newNumberMaxCall: 1,
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 401 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/changeNumberMaxCall').send({
			adminCode,
			newNumberMaxCall: 1,
			area: areaId,
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 400 if the newNumberMaxCall is not a number', async () => {
		const res = await request(app).post('/admin/campaign/changeNumberMaxCall').send({
			adminCode,
			newNumberMaxCall: NaN,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Missing parameters (newNumberMaxCall:number)');
	});

	it('should return 400 if the newNumberMaxCall is less than 1', async () => {
		const res = await request(app).post('/admin/campaign/changeNumberMaxCall').send({
			adminCode,
			newNumberMaxCall: 0,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('invalid number max call');
	});

	it('should return 200 if the campaign is found', async () => {
		const res = await request(app).post('/admin/campaign/changeNumberMaxCall').send({
			adminCode: 'password',
			newNumberMaxCall: 2,
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		const max = (await Campaign.findOne({ _id: campaignId }))?.nbMaxCallCampaign;
		expect(max).toBe(2);
	});
	it('should return 200 if the campaign is found with hash', async () => {
		const res = await request(app).post('/admin/campaign/changeNumberMaxCall').send({
			adminCode,
			newNumberMaxCall: 1,
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		const max = (await Campaign.findOne({ _id: campaignId }))?.nbMaxCallCampaign;
		expect(max).toBe(1);
	});
});
