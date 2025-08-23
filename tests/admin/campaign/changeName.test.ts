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
	await Campaign.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changeNameTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'changeNameTest',
			script: 'changeNameTest',
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

describe('post on /admin/campaign/changeName', () => {
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app).post('/admin/campaign/changeName').send({
			adminCode: 'wrong',
			newName: 'newName',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 401 if the campaign id is wrong', async () => {
		const res = await request(app).post('/admin/campaign/changeName').send({
			adminCode,
			newName: 'newName',
			area: areaId,
			CampaignId: new Types.ObjectId(),
			allreadyHashed: true
		});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 400 if the name is invalid', async () => {
		const res = await request(app).post('/admin/campaign/changeName').send({
			adminCode,
			newName: 'new',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Name invalid');
	});

	it('should return 400 if the name is invalid', async () => {
		const res = await request(app).post('/admin/campaign/changeName').send({
			adminCode,
			newName: '{new}',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Name invalid');
	});

	it('should return 200 if the name is valid', async () => {
		const res = await request(app).post('/admin/campaign/changeName').send({
			adminCode:
				'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86',
			newName: 'newName',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		const newCampaignName = (await Campaign.findById(campaignId))?.name;
		expect(newCampaignName).toBe('newName');
	});

	it('should return 200 if the name is valid with hash', async () => {
		const res = await request(app).post('/admin/campaign/changeName').send({
			adminCode,
			newName: 'newName',
			area: areaId,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body.message).toBe('OK');
		const newCampaignName = (await Campaign.findById(campaignId))?.name;
		expect(newCampaignName).toBe('newName');
	});
});
