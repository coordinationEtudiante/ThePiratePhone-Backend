import { Router } from 'express';

import ChangeAdminPassword from './router/admin/area/changeAdminPassword';
import ChangeAreaName from './router/admin/area/changeName';
import sendSms from './router/admin/area/sendSms';
import setPhone from './router/admin/area/setPhone';
import smsStatus from './router/admin/area/smsStatus';
import addCallerCampaign from './router/admin/caller/addCallerCampaign';
import callerInfo from './router/admin/caller/callerInfo';
import changeCallerPassword from './router/admin/caller/changeCallerPassword';
import ChangeName from './router/admin/caller/changeName';
import exportCallerCsv from './router/admin/caller/exportCallerCsv';
import listCaller from './router/admin/caller/listCaller';
import newCaller from './router/admin/caller/newCaller';
import removeCaller from './router/admin/caller/removeCaller';
import SearchByName from './router/admin/caller/searchByName';
import SearchByPhone from './router/admin/caller/searchByPhone';
import addClientCampaign from './router/admin/campaign/addClientCampaign';
import changeCallHours from './router/admin/campaign/changeCallHours';
import changeCampaingPassword from './router/admin/campaign/changeCampaignPassword';
import changeName from './router/admin/campaign/changeName';
import changeNumberMaxCall from './router/admin/campaign/changeNumberMaxCall';
import changeScript from './router/admin/campaign/changeScript';
import changeTimeBetwenCall from './router/admin/campaign/changeTimeBetwenCall';
import createCampaign from './router/admin/campaign/createCampaign';
import getCampaign from './router/admin/campaign/GetCampaign';
import listCallerCampaign from './router/admin/campaign/listCallerCampaign';
import listCampaign from './router/admin/campaign/listCampaign';
import listClientCampaign from './router/admin/campaign/listClientCampaign';
import setActive from './router/admin/campaign/setActive';
import setPriority from './router/admin/campaign/setPriority';
import setSatisfaction from './router/admin/campaign/setSatisfaction';
import SetSendSms from './router/admin/campaign/setSendSms';
import clientInfo from './router/admin/client/clientInfo';
import createClient from './router/admin/client/createClient';
import createClients from './router/admin/client/createClients';
import exportClientCsv from './router/admin/client/exportClientsCsv';
import removeAllClients from './router/admin/client/removeAllClients';
import removeClient from './router/admin/client/removeClient';
import SearchClientByName from './router/admin/client/searchByName';
import SearchClientByPhone from './router/admin/client/searchByPhone';
import searchComplete from './router/admin/client/searchComplete';
import validateByAPI from './router/admin/client/validateByAPI';
import loginAdmin from './router/admin/login';
import call from './router/admin/stats/call';
import callByDate from './router/admin/stats/callByDate';
import numberOfCallers from './router/admin/stats/numberOfCallers';
import response from './router/admin/stats/response';
import ChangeClientName from './router/caller/changeName';
import changePassword from './router/caller/changePassword';
import createCaller from './router/caller/createCaller';
import endCall from './router/caller/endCall';
import getPhoneNumber from './router/caller/getPhoneNumber';
import getProgress from './router/caller/getProgress';
import giveUp from './router/caller/giveUp';
import joinCampaign from './router/caller/joinCampaign';
import login from './router/caller/login';
import validateCall from './router/caller/validateCall';
import getArea from './router/getArea';
import OtherCallerInfo from './router/otherCaller/OtherCallerInfo';
import scoreBoard from './router/otherCaller/scoreBoard';

const router = Router();

router.get('/', (req, res) => {
	res.send({ message: 'Hello World!' });
});
//caller
router.post('/caller/changePassword', changePassword);
router.post('/caller/createCaller', createCaller);
router.post('/caller/endCall', endCall);
router.post('/caller/getPhoneNumber', getPhoneNumber);
router.post('/caller/getProgress', getProgress);
router.post('/caller/giveUp', giveUp);
router.post('/caller/joinCampaign', joinCampaign);
router.post('/caller/login', login);
router.post('/caller/validateCall', validateCall);
router.post('/caller/changeName', ChangeClientName);

//other caller
router.post('/otherCaller/scoreBoard', scoreBoard);
router.post('/otherCaller/info', OtherCallerInfo);

//admin/client
router.post('/admin/client/createClients', createClients);
router.post('/admin/client/removeClient', removeClient);
router.post('/admin/client/searchByName', SearchClientByName);
router.post('/admin/client/searchByPhone', SearchClientByPhone);
router.post('/admin/client/searchComplete', searchComplete);
router.post('/admin/client/removeClients', removeAllClients);
router.post('/admin/client/createClient', createClient);
router.post('/admin/client/clientInfo', clientInfo);
router.post('/admin/client/exportClientsCsv', exportClientCsv);
router.post('/admin/client/validateByAPI', validateByAPI);

//admin/area
router.post('/admin/area/changeName', ChangeAreaName);
router.post('/admin/area/changeAdminPassword', ChangeAdminPassword);
router.post('/admin/area/smsStatus', smsStatus);
router.post('/admin/area/sendSms', sendSms);
router.post('/admin/area/setPhone', setPhone);

//admin/caller
router.post('/admin/caller/addCallerCampaign', addCallerCampaign);
router.post('/admin/caller/callerInfo', callerInfo);
router.post('/admin/caller/changePassword', changeCallerPassword);
router.post('/admin/caller/changeName', ChangeName);
router.post('/admin/caller/createCaller', newCaller);
router.post('/admin/caller/removeCaller', removeCaller);
router.post('/admin/caller/searchByName', SearchByName);
router.post('/admin/caller/searchByPhone', SearchByPhone);
router.post('/admin/caller/listCaller', listCaller);
router.post('/admin/caller/exportCallersCsv', exportCallerCsv);

//admin/campaign
router.post('/admin/campaign/changePassword', changeCampaingPassword);
router.post('/admin/campaign/setActive', setActive);
router.post('/admin/campaign/changeName', changeName);
router.post('/admin/campaign/changeCallHours', changeCallHours);
router.post('/admin/campaign/changeTimeBetwenCall', changeTimeBetwenCall);
router.post('/admin/campaign/changeNumberMaxCall', changeNumberMaxCall);
router.post('/admin/campaign/addClientCampaign', addClientCampaign);
router.post('/admin/campaign/listCallerCampaign', listCallerCampaign);
router.post('/admin/campaign/listClientCampaign', listClientCampaign);
router.post('/admin/campaign/listCampaign', listCampaign);
router.post('/admin/campaign/getCampaign', getCampaign);
router.post('/admin/campaign/changeScript', changeScript);
router.post('/admin/campaign/setSatisfaction', setSatisfaction);
router.post('/admin/campaign/setPriority', setPriority);
router.post('/admin/campaign/setSendSms', SetSendSms);

//admin/
router.post('/admin/createCampaign', createCampaign);
router.post('/admin/login', loginAdmin);

//stats/
router.post('/stats/numberOfCallers', numberOfCallers);
router.post('/stats/call', call);
router.post('/stats/response', response);
router.post('/stats/callByDate', callByDate);

router.get('/getArea', getArea);
export default router;
