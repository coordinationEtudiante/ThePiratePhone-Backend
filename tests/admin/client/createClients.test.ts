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

	areaId = (
		await Area.create({
			name: 'callerInfoTest',
			password: 'password',
			campaignList: [],
			adminPassword: adminCode
		})
	).id;

	campaignId = (
		await Campaign.create({
			name: 'callerInfoTest',
			script: 'callerInfoTest',
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

describe('post on /admin/client/createClients', () => {
	it('should return 400 if too many users', async () => {
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({
				adminCode: 'password',
				area: areaId,
				data: Array.from({ length: 501 }, () => [{ phone: '+33634567890', name: 'callerInfoTest' }])
			});
		expect(res.status).toEqual(400);
		expect(res.body).toEqual({ message: 'Too many users', OK: false });
	});

	it('should return 400 if data is not an array', async () => {
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({ adminCode: 'password', area: areaId, data: 'not an array' });
		expect(res.status).toEqual(400);
		expect(res.body).toEqual({ message: 'data must be an array', OK: false });
	});

	it('should return 403 if area not found', async () => {
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({ adminCode: 'password', area: new Types.ObjectId().toHexString(), data: [] });
		expect(res.status).toEqual(403);
		expect(res.body).toEqual({ message: 'area not found or bad admin password', OK: false });
	});

	it('should return 404 if no campaign in progress', async () => {
		const newAreaId = (
			await Area.create({
				name: 'callerInfoTest',
				password: 'password',
				campaignList: [],
				adminPassword: adminCode
			})
		).id;
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({ adminCode: 'password', area: newAreaId, data: [] });
		expect(res.status).toEqual(404);
		expect(res.body).toEqual({ message: 'no campaign in progress', OK: false });
	});

	it('should return error if data is not on the right format', async () => {
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({ adminCode: 'password', area: areaId, data: ['not an object'] });
		expect(res.status).toEqual(400);
		expect(res.body).toEqual({
			message:
				'Each data entry must be an object with valid properties: {phone:string, name?:string, firstname?:string, institution?:string, priority?:string, firstIntegration?:date, integrationReason?:string}',
			OK: false
		});
	});

	it('should return 200 if all fine', async () => {
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({
				adminCode: 'password',
				area: areaId,
				data: [
					{
						phone: '+33634567890',
						name: 'callerInfoTest',
						firstname: 'callerInfoTest',
						priority: 'prio 1'
					},
					{
						phone: '+33634567891',
						name: 'callerInfoTest2',
						firstname: 'callerInfoTest2',
						priority: 'prio 2'
					}
				]
			});
		expect(res.status).toEqual(200);
		expect(res.body).toEqual({ message: 'OK', OK: true, errors: [] });
		const clients = await Client.find({ campaigns: campaignId });
		expect(clients.length).toEqual(2);
	});
	it('should return 200 if all fine and update', async () => {
		const res = await request(app)
			.post('/admin/client/createClients')
			.send({
				adminCode: 'password',
				area: areaId,
				data: [
					{
						phone: '+33634567890',
						name: 'callerInfoTestUpdated',
						firstname: 'callerInfoTestUpdated',
						priority: 'prio 1'
					}
				],
				updateIfExist: true
			});
		expect(res.status).toEqual(200);
		expect(res.body).toEqual({ message: 'OK', OK: true, errors: [] });
		const clients = await Client.find({ campaigns: campaignId });
		expect(clients.length).toEqual(2);
		const updatedClient = clients.find(c => c.phone === '+33634567890');
		expect(updatedClient?.name).toEqual('callerInfoTestUpdated');
	});
});
