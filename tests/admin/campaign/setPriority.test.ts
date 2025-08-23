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
			name: 'setPriorityTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	CampaignId = (
		await Campaign.create({
			name: 'setPriorityTest',
			script: 'setPriorityTest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false }
			],
			password: 'password',
			sortGroup: [
				{ name: 'prio1', id: 'md4rye5b' },
				{ name: 'prio2', id: 'md4ryvjl' },
				{ name: 'default', id: '-1' }
			]
		})
	).id;
	Area.updateOne({ _id: areaId }, { $push: { campaignList: CampaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/campaign/setPriority', () => {
	it('should return 400 if prioritys is not an array', async () => {
		const res = await request(app).post('/admin/campaign/setPriority').send({
			adminCode,
			area: areaId,
			allreadyHashed: true,
			priority: 'notAnArray'
		});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe(
			'Invalid priority, priority must be a array<{ name: string, id: string(length = 8) }>'
		);
	});
	it('should return 401 if the admin code is wrong', async () => {
		const res = await request(app)
			.post('/admin/campaign/setPriority')
			.send({
				adminCode: 'wrong',
				area: areaId,
				allreadyHashed: true,
				priority: [
					{ name: 'prio2', id: 'md4ryvjl' },
					{ name: 'prio1', id: 'md4rye5b' }
				]
			});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should return 401 if the campaign id is wrong', async () => {
		const res = await request(app)
			.post('/admin/campaign/setPriority')
			.send({
				adminCode,
				area: areaId,
				CampaignId: new Types.ObjectId().toHexString(),
				allreadyHashed: true,
				priority: [
					{ name: 'prio2', id: 'md4ryvjl' },
					{ name: 'prio1', id: 'md4rye5b' }
				]
			});
		expect(res.status).toBe(401);
		expect(res.body.message).toBe('Wrong campaign id');
	});

	it('should return 400 if prioritys is not an array of { name: string, id: string(length = 8) }', async () => {
		const res = await request(app)
			.post('/admin/campaign/setPriority')
			.send({
				adminCode,
				area: areaId,
				allreadyHashed: true,
				priority: [42]
			});
		expect(res.status).toBe(400);
		expect(res.body.message).toBe(
			'Invalid priority, priority must be a array<{ name: string, id: string(length = 8) }>'
		);
	});

	it('should return 200 if prioritys is an array of { name: string, id: string(length = 8) }', async () => {
		const res = await request(app)
			.post('/admin/campaign/setPriority')
			.send({
				adminCode,
				area: areaId,
				allreadyHashed: true,
				priority: [
					{ name: 'prio2', id: 'md4ryvjl' },
					{ name: 'prio1', id: 'md4rye5b' }
				]
			});
		expect(res.status).toBe(200);
		const campaign = await Campaign.findOne({ _id: CampaignId });
		expect(campaign).toBeDefined();
		expect(campaign?.sortGroup).toBeDefined();
		expect(campaign?.sortGroup.length).toBe(3); // including default
		expect(campaign?.sortGroup[0].name).toBe('prio2');
		expect(campaign?.sortGroup[0].id).toBe('md4ryvjl');
		expect(campaign?.sortGroup[1].name).toBe('prio1');
		expect(campaign?.sortGroup[1].id).toBe('md4rye5b');
		expect(campaign?.sortGroup[2].name).toBe('default');
		expect(campaign?.sortGroup[2].id).toBe('-1');
	});
});
