const STRONG_REGEX = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})";
// noinspection SpellCheckingInspection
const crypto = require('crypto');

var numberFormat = function(number, decimal){
    decimal = isNaN(decimal = Math.abs(decimal)) ? 2 : decimal;
    var d = ".",t = ",";
    var s = number < 0 ? "-" : "",
        i = String(parseInt(number = Math.abs(Number(number) || 0).toFixed(decimal))),
        j = (j = i.length) > 3 ? j % 3 : 0;
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "1" + t) + (decimal ? d + Math.abs(number - i).toFixed(decimal).slice(2) : "");
};

var randomString = function(length, rules){
	var text = "";
	var numbers = "0123456789";
	var letters = "abcdefghijklmnopqrstuvwxyz";
	var possible = letters.toUpperCase()+letters.toLowerCase()+numbers;
	if(typeof rules !== 'undefined'){
		if(typeof rules['numbersOnly'] !== 'undefined' && rules['numbersOnly']){
			possible = numbers;
		} else if(typeof rules['lettersOnly'] !== 'undefined' && rules['lettersOnly']){
			possible = letters.toUpperCase()+letters.toLowerCase();
		}
		if(typeof rules['excludeUppercase'] !== 'undefined' && rules['excludeUppercase'])
			possible.replace(letters.toUpperCase(), "");
		if(typeof rules['excludeLowercase'] !== 'undefined' && rules['excludeLowercase'])
			possible.replace(letters.toLowerCase(), "");
		if(typeof rules['excludeNumbers'] !== 'undefined' && rules['excludeNumbers'])
			possible.replace(numbers, "");
	}

	for (var i = 0; i < length; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
};

var timestampToDate = function(unix_timestamp){
	var date = new Date(unix_timestamp);
	var day = date.getDate();
	var month = date.getMonth();
    var year = date.getFullYear();
	var hours = date.getHours();
	var minutes = "0" + date.getMinutes();

	var n = hours/12;hours = hours%12;
	return day+"/"+month+"/"+year+" "+(hours === 0 ? "12" : hours)+":"+minutes.substr(-2)+(n > 0 ? "pm" : "am");
};

var encryptData = function(data){
	var secureConfig = require('../app-config').getConfig('session.security');
	return crypto.pbkdf2Sync(data, secureConfig['secret'], 100000, 64, 'sha512').toString('hex');
};

var validateEmail = function(email){
	var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(String(email).toLowerCase());
};

module.exports = {
	STRONG_REGEX : STRONG_REGEX,
    numberFormat : numberFormat,
	randomString : randomString,
	encryptData : encryptData,
	validateEmail : validateEmail,
    timestampToDate : timestampToDate
};