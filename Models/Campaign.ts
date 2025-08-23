import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		index: true
	},
	script: {
		type: String,
		required: true,
		default: 'No script'
	},
	active: {
		type: Boolean,
		required: true,
		default: false,
		unique: false,
		index: true
	},
	area: {
		type: mongoose.Schema.ObjectId,
		ref: 'Area',
		required: true,
		index: true
	},
	createdAt: {
		type: Date,
		default: Date.now()
	},
	password: {
		type: String,
		required: true,
		unique: false,
		index: true
	},
	//personalisation
	nbMaxCallCampaign: {
		type: Number,
		required: true,
		default: 4
	},
	timeBetweenCall: {
		type: Number,
		required: true,
		default: 10_800_000
	},
	callHoursStart: {
		type: Date,
		required: true,
		default: new Date(0)
	},
	callHoursEnd: {
		type: Date,
		required: true,
		default: new Date(0)
	},
	callPermited: {
		type: Boolean,
		require: true,
		default: true
	},
	status: {
		type: [{ name: String, toRecall: Boolean }], // [status, to recall]
		require: true,
		default: [
			{ name: 'À rappeler', toRecall: true },
			{ name: 'À retirer', toRecall: false },
			{ name: '[hide] validate by API', toRecall: false }
		]
	},
	sortGroup: {
		type: [{ name: String, id: String }],
		required: true,
		default: [
			{ name: 'prio1', id: 'md4rye5b' },
			{ name: 'prio2', id: 'md4ryvjl' },
			{ name: 'default', id: '-1' }
		]
	}
});

export const Campaign = mongoose.model('campaign', CampaignSchema);
