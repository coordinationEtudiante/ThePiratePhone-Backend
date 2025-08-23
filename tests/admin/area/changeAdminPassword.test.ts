import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../../index';
import { Area } from '../../../Models/Area';
dotenv.config({ path: '.env' });
let areaId: mongoose.Types.ObjectId | undefined;
const adminPassword =
	'b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86'; //password
beforeAll(async () => {
	await mongoose.connect(process.env.URITEST ?? '');
	await Area.deleteMany({});

	areaId = (
		await Area.create({
			name: 'changepassordtest',
			password: 'password',
			campaignList: [],
			adminPassword: adminPassword
		})
	).id;
});

afterAll(async () => {
	await mongoose.connection.close();
});

describe('post on /admin/area/changeAdminPassword', () => {
	it('should return 400 if bad new admin password', async () => {
		const res = await request(app).post('/admin/area/changeAdminPassword').send({
			adminCode: adminPassword,
			area: areaId,
			newPassword: ' '
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'bad new admin password');
	});

	it('should return 404 if no area found', async () => {
		const res = await request(app).post('/admin/area/changeAdminPassword').send({
			adminCode: adminPassword,
			area: new mongoose.Types.ObjectId(),
			newPassword: 'newPassword'
		});
		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('message', 'no area found');
	});

	it('should return 400 if new password is too long', async () => {
		const res = await request(app)
			.post('/admin/area/changeAdminPassword')
			.send({
				adminCode: adminPassword,
				area: areaId,
				newPassword: 'a'.repeat(513)
			});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'new password is too long (max 512)');
	});

	it('should return 400 if new password is not a hash', async () => {
		const res = await request(app).post('/admin/area/changeAdminPassword').send({
			adminCode: adminPassword,
			area: areaId,
			newPassword:
				'6f63f637f1346149532158022899bdf424a19c3dc472e21c2068cd324d7263ed521fb1c1335afaad6bf3fd94a24c0371217086295255e7773eb8deb2c7a54e1{',
			allreadyHashed: true
		});
		expect(res.status).toBe(400);
		expect(res.body).toHaveProperty('message', 'new password is not a hash');
	});

	it('should return 200 if OK', async () => {
		const res = await request(app).post('/admin/area/changeAdminPassword').send({
			adminCode: 'password',
			area: areaId,
			newPassword: 'newPassword'
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'password of area changed');
		const areaNewPassword = (await Area.findById(areaId))?.adminPassword;
		expect(areaNewPassword).toBe(
			'6f63f637f1346149532158022899bdf424a19c3dc472e21c2068cd324d7263ed521fb1c1335afaad6bf3fd94a24c0371217086295255e7773eb8deb2c7a54e1a' //newPassword
		);
	});

	it('should return 200 if OK with hash', async () => {
		const password =
			'6f63f637f1346149532158022899bdf424a19c3dc472e21c2068cd324d7263ed521fb1c1335afaad6bf3fd94a24c0371217086295255e7773eb8deb2c7a54e1a'; //newPassword
		const newAreaPassword =
			'61091da3ec0876fe0ccda287340e15d16b0fcfc94a941c56ec629b0dd8d46c2d67bbe28dac5e6c2d601744f08dba348b718dcb65353f0cddb7cf4a21b29523e4'; // newAreaPassword
		//the fist area is consumed by the last test
		const areaId2 = (
			await Area.create({
				name: 'changepassordtest2',
				password: 'password',
				campaignList: [],
				adminPassword: password
			})
		).id;
		const res = await request(app).post('/admin/area/changeAdminPassword').send({
			adminCode: password,
			area: areaId2,
			newPassword: newAreaPassword,
			allreadyHashed: true
		});
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('message', 'password of area changed');
		const areaNewPassword = (await Area.findById(areaId2))?.adminPassword;
		expect(areaNewPassword).toBe(newAreaPassword);
	});
});
