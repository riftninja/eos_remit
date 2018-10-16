var httpService = require('../controllers/http-service');
var configurations = require('../app-config');
var utilities = require('./utilities');

const FAILED = 'failed';
const PENDING = 'pending';
const COMPLETED = 'completed';
const SUCCESSFUL = 'successful';
const PROCESSING = 'processing';
const CARD_PAYMENT = 'card';
const BANK_PAYMENT = 'bank';

/**
 * @param transactionRef":"MC_1522966555872", // could be any (unique) string
 * @param email, e.g "bojack@horsinaround.com",
 * @param amount, e.g 5000 in NGN, would be converted to Kobo
 * @param extraData, data object and extra information
 * @param callback
 * @param errorCallback
 *
 * note: "extraData" is for reference purposes only, it does not affect transaction in anyway
 */
var initTransaction = function(transactionRef, email, amount, extraData, callback, errorCallback){
	amount = Math.ceil(parseFloat(amount) * 100);
	var payload = {
		email: email,
		amount: amount,
		reference: transactionRef,
		metadata: JSON.stringify(extraData)
	};

	var httpRequest = new httpService.httpRequest();
	var paymentConfig = configurations.getConfig('payment');
	httpRequest.addHeader('Authorization', 'Bearer '+paymentConfig['secret_key']);
	httpRequest.addOption("path", "/transaction/initialize");
	httpRequest.addOption("host", paymentConfig.host);
	httpRequest.addOption("secure", true);

	httpRequest.post(payload, function(resp){
		if(typeof callback !== 'undefined') callback(resp);
	}, function(err){
		if(typeof errorCallback !== 'undefined') errorCallback(err);
	});
};

/** get transaction details from blockchain and payment service provider(s)
 *
 * @param transactionRef
 * @param callback
 */
var getTransactionDetails = function(transactionRef, callback){
	var transactionDetails = null;

	transactionDetails = {};// todo get record from eos

	verifyTransaction(transactionRef, function(status, resp){
		transactionDetails.meta_data = resp;
		callback(transactionDetails);
	}, function(){
		callback(transactionDetails);
	});
};

/**
 * @param params, // details bank transaction
 * @param successCallback
 * @param errorCallback
 */
var processBankTransfer = function(params, successCallback, errorCallback){
	if(typeof params.recipient === 'undefined')
		return errorCallback({ error: 400, message: 'bad request, recipient error'});

	var recipientDetails = {
		type: "nuban",
		currency: "NGN",
		name: params.recipient['name'],
		bank_code: params.recipient['bank_code'],
		account_number: params.recipient['account_number'],
		description: "Recipient details for EOS remittance service"
	};

	var httpRequest = new httpService.httpRequest();
	var paymentConfig = configurations.getConfig('payment');
	httpRequest.addHeader('Authorization', 'Bearer '+paymentConfig['secret_key']);
	httpRequest.addOption("path", "/transferrecipient");
	httpRequest.addOption("host", paymentConfig.host);
	httpRequest.addOption("secure", true);
	httpRequest.post(recipientDetails, function(resp){
		if(typeof resp.status !== 'undefined' && resp.status){
			var amount = Math.ceil(parseFloat(params.amount) * 100);
			var payload = {
				amount: amount,
				source: "balance",
				recipient: resp.data["recipient_code"],
				reason: "Recipient for transaction "+params.transaction_ref
			};

			httpRequest.addOption("path", "/transfer");
			httpRequest.post(payload, function(response){
				successCallback(response);
			}, function (error) {
				errorCallback(error);
			});
		} else {
			errorCallback(resp);
		}
	}, function(err){
		errorCallback(err);
	});
};

/** update transaction status and meta data on blockchain
 * @param params, data object, transaction reference id and other reference parameters
 * @param values, data object, contains new data and transaction status
 * @param callback
 */
var updateTransaction = function (params, values, callback) {
	// todo update transaction on blockchain
};

/** verify transaction status with service provider, also return service provider's transaction record
 * @param transactionRef, transaction reference id
 * @param successCallback
 * @param errorCallback
 */
var verifyTransaction = function(transactionRef, successCallback, errorCallback){
	var httpRequest = new httpService.httpRequest();
	var paymentConfig = configurations.getConfig('payment');
	httpRequest.addHeader('Authorization', 'Bearer '+paymentConfig['secret_key']);
	httpRequest.addOption("path", "/transaction/verify/"+transactionRef);
	httpRequest.addOption("host", paymentConfig.host);
	httpRequest.addOption("secure", true);

	httpRequest.get({}, function(resp){
		successCallback(resp.status, resp);
	}, function(err){
		errorCallback(err);
	});
};

module.exports = {
	FAILED: FAILED,
	PENDING: PENDING,
	COMPLETED: COMPLETED,
	SUCCESSFUL: SUCCESSFUL,
	PROCESSING: PROCESSING,
	CARD_PAYMENT: CARD_PAYMENT,
	BANK_PAYMENT: BANK_PAYMENT,
	initTransaction: initTransaction,
	verifyTransaction: verifyTransaction,
	updateTransaction: updateTransaction,
	processBankTransfer: processBankTransfer,
	getTransactionDetails: getTransactionDetails
};