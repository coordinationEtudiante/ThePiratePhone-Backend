import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Campaign } from '../../../Models/Campaign';

dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;

const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'createCampaignTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe(' post on /admin/createCampaign', () => {
	it('should return 400 if the satisfaction is not an array', async () => {
		const res = await request(app).post('/admin/createCampaign').send({
			adminCode,
			name: 'createCampaignTest',
			script: 'createCampaignTest',
			password: 'password',
			area: areaId,
			satisfactions: 'satisfaction',
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Invalid satisfaction, satisfactions must be a array<string>');
	});

	it('should return 400 if the satisfaction is not an array of string', async () => {
		const res = await request(app)
			.post('/admin/createCampaign')
			.send({
				adminCode,
				name: 'createCampaignTest',
				script: 'createCampaignTest',
				password: 'password',
				area: areaId,
				satisfactions: [1],
				allreadyHashed: true
			});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Invalid satisfaction, satisfactions must be a array<string>');
	});
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/createCampaign').send({
			adminCode: 'wrong',
			name: 'createCampaignTest',
			script: 'createCampaignTest',
			password: 'password',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 400 if the campaign already exist', async () => {
		await Campaign.create({
			name: 'createCampaignTest4',
			script: 'createCampaignTest4',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password'
		});
		const res = await request(app).post('/admin/createCampaign').send({
			adminCode,
			name: 'createCampaignTest4',
			script: 'createCampaignTest4',
			password: 'password',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Campaign already exist');
	});

	it('should return 200 if the campaign is created with hash', async () => {
		const res = await request(app).post('/admin/createCampaign').send({
			adminCode,
			name: 'createCampaignTest2',
			script: 'createCampaignTest2',
			password: 'password',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Campaign created');
		const campaign = await Campaign.findOne({ name: 'createCampaignTest2' });
		expect(campaign).not.toBeNull();
	});

	it('should return 200 if the campaign is created', async () => {
		const res = await request(app).post('/admin/createCampaign').send({
			adminCode: 'password',
			name: 'createCampaignTest3',
			script: 'createCampaignTest3',
			password: 'password',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Campaign created');
		const campaign = await Campaign.findOne({ name: 'createCampaignTest3' });
		expect(campaign).not.toBeNull();
	});
});
