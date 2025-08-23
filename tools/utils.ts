import { Response } from 'express';
import { sha512 } from 'js-sha512';
import mongoose from 'mongoose';
import stringSimilarity from 'string-similarity';

import { Caller } from '../Models/Caller';
import { Campaign } from '../Models/Campaign';
import { Client } from '../Models/Client';
import { log } from './log';

/**
 * return the filename from file path
 * @param filename complet file path
 * @returns file name from filepath
 */
function getFileName(filename: string) {
	return filename?.split('\\')?.at(-1)?.split('/')?.at(-1) ?? 'error';
}

/**
 * @summary Clears and formats a phone number.
 *
 * This function takes a string representing a phone number and performs several transformations to ensure it is in a standardized format:
 * - Trims any leading or trailing whitespace.
 * - Removes all spaces, dots, dashes, 'o', parentheses, and '+' characters.
 * - Adds a '0' at the beginning if the number starts with '6' or '7'.
 * - Adjusts numbers starting with '33' to remove the first two digits if they are 11 digits long.
 * - Converts numbers starting with '06' to '+336' followed by the remaining digits.
 * - Ensures numbers starting with '0' are prefixed with '+33'.
 *
 * @param phoneNumber - The phone number string to be cleared and formatted.
 * @returns A standardized french phone number string or an empty string if the input is not a valid string.
 */
function clearPhone(phoneNumber: string): string {
	if (typeof phoneNumber != 'string') return '';
	phoneNumber = phoneNumber.trim();

	phoneNumber = phoneNumber.replaceAll(' ', '');
	phoneNumber = phoneNumber.replaceAll('.', '');
	phoneNumber = phoneNumber.replaceAll('-', '');
	phoneNumber = phoneNumber.replaceAll('o', '0');
	phoneNumber = phoneNumber.replaceAll('(', '');
	phoneNumber = phoneNumber.replaceAll(')', '');
	phoneNumber = phoneNumber.replaceAll('+33', '33');

	if (phoneNumber.startsWith('6') || phoneNumber.startsWith('7')) {
		phoneNumber = '0' + phoneNumber;
	}
	if (phoneNumber.startsWith('33') && phoneNumber.length == 11) {
		phoneNumber = '0' + phoneNumber.slice(2);
	}
	if (phoneNumber.length == 12 && phoneNumber.startsWith('06')) {
		phoneNumber = '+336' + phoneNumber.slice(2);
	}
	if (phoneNumber.startsWith('0')) {
		phoneNumber = phoneNumber.replace('0', '+33');
	}
	return phoneNumber;
}

function phoneNumberCheck(phone: string): boolean {
	if (typeof phone != 'string') return false;
	if (!phone.startsWith('+')) return false;

	phone = phone.replaceAll(' ', '');

	const phoneArray = phone.split('');
	if (phone.length % 2 == 0) {
		phoneArray.splice(0, 3);
	} else {
		phoneArray.splice(0, 4);
	}
	phone = phoneArray.join('');
	if (phone.match(/^[0-9]{9}$/)) return true;
	return false;
}

function humainPhone(number: string) {
	const numberArray = number.split('');
	let newNumber = '';
	if (number.length % 2) {
		newNumber += numberArray.splice(0, 4).join('');
	} else {
		newNumber += numberArray.splice(0, 3).join('');
	}
	newNumber += ' ' + numberArray.splice(0, 1);
	for (let i = 0; i < numberArray.length; i = i + 2) {
		newNumber += ' ' + numberArray[i] + numberArray[i + 1];
	}

	if (newNumber.startsWith('+33 ')) {
		newNumber = newNumber.replace('+33 ', '0');
	}

	return newNumber;
}

function cleanStatus(status: 'In progress' | 'to recall' | 'Done' | 'deleted' | undefined) {
	switch (status) {
		case 'In progress':
			return 'En cours';
		case 'to recall':
			return 'Doit être rappelé·e';
		case 'Done':
			return 'Appelé·e';
		case 'deleted':
			return 'Supprimé·e';
		default:
			return 'Pas appelé·e';
	}
}

/**
 * Sanitizes a given string by removing any characters that are not letters, numbers, spaces, periods, commas, underscores, or hyphens.
 *
 * @param str - The string to be sanitized.
 * @returns The sanitized string with leading and trailing whitespace removed.
 */
function sanitizeString(str: string) {
	str = str.replace(/[{,},$]/gm, '');
	return str.trim();
}

/**
 * Check if the parameters are in the body
 * @param body
 * @param res
 * @param parameters - Array of [string, any, bolean?] where the first string is the name of the parameter and the second is the type of the parameter, the third is optional and is a boolean to check if the parameter is optional
 * @param orgin
 * @returns boolean - true if all parameters are in the body
 *
 * @throws 400 - Missing parameters body is empty
 * @throws 400 - Missing parameters ( first parameter missing)
 */
function checkParameters(
	body: any,
	res: Response<any>,
	parameters: Array<
		[
			string,
			(
				| 'string'
				| 'number'
				| 'bigint'
				| 'boolean'
				| 'symbol'
				| 'undefined'
				| 'object'
				| 'function'
				| 'ObjectId'
				| 'Date'
			),
			// | 'array' dont work with array
			boolean?
		]
	>,
	orgin: string
): boolean {
	const ip = res.req.hostname;
	if (parameters.length == 0) return true;
	if (!body || Object.keys(body).length == 0) {
		res.status(400).send({ message: 'Missing parameters body is empty', OK: false });
		log(`[${ip}] Missing parameters body is empty`, 'WARNING', orgin);
		return false;
	}
	for (let parameter of parameters) {
		if (parameter[2] && !body[parameter[0]]) {
			continue;
		}

		if (body[parameter[0]] == undefined) {
			res.status(400).send({ message: `Missing parameters (${parameter.join(':')})`, OK: false });
			log(`[${body.phone ?? ''} ${ip}] Missing parameters (${parameter.join(':')})`, 'WARNING', orgin);
			return false;
		}

		const errorText = `Wrong type for parameter (${parameter[0]} is type: ${typeof body[
			parameter[0]
		]} but required type is ${parameter[1]})`;

		if (parameter[1] == 'ObjectId') {
			if (body[parameter[0]].length != 24) {
				res.status(400).send({
					message: errorText,
					OK: false
				});
				log(`[${ip}] ` + errorText, 'WARNING', orgin);
				return false;
			}
			if (!mongoose.isValidObjectId(body[parameter[0]])) {
				res.status(400).send({
					message: errorText,
					OK: false
				});
				log(`[${ip}] ` + errorText, 'WARNING', orgin);
				return false;
			}
		} else if (parameter[1] == 'number' && isNaN(parseInt(body[parameter[0]]))) {
			// if is nan return Missing parameters because NaN == undefined
			res.status(400).send({
				message: errorText,
				OK: false
			});
			log(`[${ip}] ` + errorText, 'WARNING', orgin);
			return false;
			// } else if (parameter[1] == 'array' && !Array.isArray(body[parameter[0]])) {
			// 	res.status(400).send({
			// 		message: errorText,
			// 		OK: false
			// 	});
			// 	log(`[${ip}] ` + errorText, 'WARNING', orgin);
			// 	return false;
		} else if (parameter[1] == 'Date' && !isNaN(new Date(body[parameter[0]]).getTime())) {
			res.status(400).send({
				message: errorText,
				OK: false
			});
			log(`[${ip}] ` + errorText, 'WARNING', orgin);
			return false;
		} else if (typeof body[parameter[0]] != parameter[1]) {
			res.status(400).send({
				message: errorText,
				OK: false
			});
			log(`[${ip}] ` + errorText, 'WARNING', orgin);
			return false;
		}
	}
	return true;
}

function checkPinCode(pinCode: string, res: Response<any>, orgin: string): boolean {
	if (pinCode.length != 4 || Number.isNaN(parseInt(pinCode))) {
		res.status(400).send({ message: 'Invalid pin code', OK: false });
		log(`[${res.req.hostname}] Invalid pin code`, 'WARNING', orgin);
		return false;
	}
	return true;
}

function hashPasword(password: string, allreadyHashed: boolean, res: Response<any>): string | false {
	if (!allreadyHashed || password.length !== 128) {
		return sha512(password).toString();
	}

	const isHex = /^[a-fA-F0-9]{128}$/.test(password);
	if (!isHex) {
		res.status(400).send({ OK: false, message: 'new password is not a hash' });
		log(`[${res.req.hostname}] new password is not a hash`, 'WARNING', __filename);
		return false;
	}

	return password;
}

async function partialSearchClient(
	campaign: InstanceType<typeof Campaign> | null,
	name: string,
	firstName: string,
	phoneFragmentStart?: string,
	phoneFragmentEnd?: string
): Promise<{
	message: string;
	OK: boolean;
	data?: { [key: string]: any };
}> {
	const searchName = sanitizeString(name?.trim());
	const searchFirstName = sanitizeString(firstName?.trim());
	let phoneStart = sanitizeString(phoneFragmentStart?.trim() ?? '');
	let phoneEnd = sanitizeString(phoneFragmentEnd?.trim() ?? '');

	const query: any = { campaigns: campaign };

	function escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	phoneStart = phoneStart ? escapeRegex(phoneStart) : '';
	phoneEnd = phoneEnd ? escapeRegex(phoneEnd) : '';

	if (phoneStart && phoneEnd) {
		query.phone = { $regex: new RegExp(`^\\+?${phoneStart}\\d*${phoneEnd}$`, 'i') };
	} else if (phoneStart) {
		query.phone = { $regex: new RegExp(`^\\+?${phoneStart}\\d*`, 'i') };
	} else if (phoneEnd) {
		query.phone = { $regex: new RegExp(`+\\d*${phoneEnd}$`, 'i') };
	}

	const firstPassQuery = { ...query };
	if (searchName) {
		firstPassQuery.name = { $regex: new RegExp(`^${searchName}$`, 'i') };
	}
	if (searchFirstName) {
		firstPassQuery.firstname = { $regex: new RegExp(`^${searchFirstName}$`, 'i') };
	}

	const clients = await Client.find(firstPassQuery, ['name', 'phone', 'firstname']).limit(1);

	if (!clients || clients.length != 1) {
		return await searchWithCursor();
	} else {
		return { message: 'found on first pass', OK: true, data: clients[0] };
	}
	// =========== deep search =========== \\
	async function searchWithCursor() {
		const cursor = Client.find(query, ['name', 'firstname', 'phone']).cursor();

		let bestMatch: any = null;
		let bestScore = 0;

		for await (const client of cursor) {
			let score = 0;
			if (searchName && client.name) {
				score += stringSimilarity.compareTwoStrings(searchName.toLowerCase(), client.name.toLowerCase());
			}
			if (searchFirstName && client.firstname) {
				score += stringSimilarity.compareTwoStrings(
					searchFirstName.toLowerCase(),
					client.firstname.toLowerCase()
				);
			}

			if (score > bestScore) {
				bestScore = score;
				bestMatch = client;
			}

			if (score >= 1.8) break;
		}

		if (bestMatch && bestScore >= 0.5) {
			return { message: 'found on second pass', OK: true, data: bestMatch };
		} else {
			return { message: 'no client found', OK: false };
		}
	}
}

export {
	checkParameters,
	checkPinCode,
	cleanStatus,
	clearPhone,
	getFileName,
	hashPasword,
	humainPhone,
	partialSearchClient,
	phoneNumberCheck,
	sanitizeString
};
