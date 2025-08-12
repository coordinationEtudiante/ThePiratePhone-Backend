import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
import { Call } from '../../../Models/Call';
import { Caller } from '../../../Models/Caller';
import { Campaign } from '../../../Models/Campaign';
import { Client } from '../../../Models/Client';
dotenv.config({ path: '.env' });

let areaId: mongoose.Types.ObjectId | undefined;
let campaignId: mongoose.Types.ObjectId | undefined;
let clientId: mongoose.Types.ObjectId | undefined;
const adminCode =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password

beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});
	await Client.deleteMany({});
	await Caller.deleteMany({});
	await Call.deleteMany({});

	areaId = (
		await Area.create({
			name: 'validateByAPITest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'validateByAPITest',
			script: 'validateByAPITest',
			active: true,
			area: areaId,
			status: [
				{ name: 'À rappeler', toRecall: true },
				{ name: 'À retirer', toRecall: false },
				{ name: '[hide] validate by API', toRecall: false }
			],
			password: 'password'
		})
	).id;

	clientId = (
		await Client.create({
			name: 'ZRAIKA',
			firstname: 'Romane',
			phone: '+33134567890',
			area: areaId,
			campaigns: [campaignId],
			priority: [{ campaign: campaignId, id: '-1' }]
		})
	).id;
	await Client.create({
		name: 'other',
		phone: '+33134567891',
		area: areaId,
		campaigns: [campaignId],
		priority: [{ campaign: campaignId, id: '-1' }]
	});
	Area.updateOne({ _id: areaId }, { $push: { campaignList: campaignId } });
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/client/validateByAPI', () => {
	it('should return 401 if wrong admin code', async () => {
		const res = await request(app).post('/admin/client/validateByAPI').send({
			adminCode: 'wrongPassword',
			name: 'validateByAPITest',
			firstName: 'validateByAPITest',
			comment: 'auto-validate by test suite',
			area: areaId
		});
		expect(res.status).toBe(401);
		expect(res.body.OK).toBe(false);
		expect(res.body.message).toBe('Wrong admin code');
	});

	it('should works', async () => {
		const res = await request(app).post('/admin/client/validateByAPI').send({
			adminCode,
			allreadyHaseded: true,
			name: 'ZRAIKA',
			firstName: 'Romane',
			comment: 'auto-validate by test suite1',
			area: areaId
		});
		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.message).toBe('this client has been validate');
		const call = await Call.findOne({ comment: 'auto-validate by test suite1' });
		expect(call).toMatchObject({
			satisfaction: '[hide] validate by API',
			comment: 'auto-validate by test suite1',
			status: false,
			duration: 0
		});
	});

	it('should works with Caller already exist', async () => {
		await Caller.deleteMany({});
		await new Caller({
			name: 'API Caller',
			phone: '+33000000000',
			pinCode: '1970',
			campaigns: await Campaign.find({}, [])
		}).save();

		const res = await request(app).post('/admin/client/validateByAPI').send({
			adminCode,
			allreadyHaseded: true,
			name: 'ZRAIKA',
			firstName: 'Romane',
			comment: 'auto-validate by test suite2',
			area: areaId
		});

		expect(res.status).toBe(200);
		expect(res.body.OK).toBe(true);
		expect(res.body.message).toBe('this client is already called by an reel caller');
	});
});
