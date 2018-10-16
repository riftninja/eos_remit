var express = require('express');
var router = express.Router();

var configurations = require('../app-config');
var banks = [];

var fetchBanks = function(){
	var httpService = require('../controllers/http-service');
	var request = new httpService.httpRequest();
	var paymentConfig = configurations.getConfig('payment');
	request.addHeader('Authorization', 'Bearer '+paymentConfig['secret_key']);
	request.addOption("host", paymentConfig.host);
	request.addOption("path", "/bank");
	request.addOption("secure", true);
	request.get({}, function(resp){
		if(typeof resp.status !== 'undefined' && resp.status){
			banks = resp.data;
		} else {
			console.log('Bank(s) error: ', { error: 404, message: 'not found', data: [] });
		}
	}, function(err){
		console.log("Bank(s) error:", err);
	});
};

/* GET home page. */
router.get('/', function(req, res) {
	res.render('index', { title: 'EOS Remit Relayer' });
});

router.get('/transaction/:transactionRef', function(req, res){
	// return eos transaction details
	// return service provider transaction details
});

router.post('/transaction/verify/webhook', function(req, res){

	var sendResponse = function(response){
		res.send(response);
	};

	transactionService.verifyTransaction(req.body.data.reference, function(transactionSuccessful, verifyResponse){
		transactionService.getTransactions({transaction_ref: req.body.data.reference}, function (assetTransactions) {
			var verifyStatus = verifyResponse.data.status.toLowerCase();
			if(assetTransactions.length > 0){
				var assetTransaction = assetTransactions[0];

				// 10 kobo error margin
				var transactionAmount = parseFloat(assetTransaction.total_amount.toString()) * 100;
				if (transactionAmount <= (parseFloat(verifyResponse.data['amount'].toString()) + 10) &&
					(verifyStatus === 'success' || verifyStatus === 'successful') && transactionSuccessful) {
					transactionService.updateTransaction({transaction_ref: req.body.data.reference}, {
						logs: assetTransaction.logs+JSON.stringify(verifyResponse),
						status: transactionService.PROCESSING
					});

					userAccount.getAccount(assetTransaction.user_id, function(accountDetails){
						var assetDetails = {};
						var paymentMethod = {};
						try {
							assetDetails = JSON.parse(assetTransaction['meta']);
							paymentMethod = JSON.parse(assetTransaction['payment_method']);
						} catch (err){}
						if(paymentMethod['method'] === 'bank'){
							var accountNumber = paymentMethod['account_number'];
							paymentMethod['account_number'] = accountNumber.substring(7);
						} else if(typeof paymentMethod.card_type !== 'undefined'){
							paymentMethod.card_type = paymentMethod.card_type.toCamelCase();
						}
						assetTransaction.order_type = assetTransaction.order_type.toUpperCase();
						var emailBody = {
							layout: false,
							assetDetails: assetDetails,
							transaction: assetTransaction,
							payment_method: paymentMethod,
							email: accountDetails['email'],
							name: accountDetails['first_name'],
							is_bank: (paymentMethod['method'] === 'bank'),
							created_on: (new Date(Date.now())).toUTCString()
						};

						var mailer = new emailService.mailer();
						res.render('mail-templates/default-receipt', emailBody, function (err, mailBody) {
							if(!err){
								mailer.sendMail('Trove <'+mailer.options.auth.user+'>', accountDetails.email, "Trove Receipt", mailBody, [], function(resp) {
									if (resp.error) { console.log(resp.error); }
									console.log('Verification Mail status:-> %s', JSON.stringify(resp.info));
								});
							} else {
								console.log("template render error: %s", err);
								console.log(err);
							}
						});

						/*** send mail to admins ***/
						var admins = ["hello@troveapp.co", "tomi@troveapp.co", "ope@troveapp.co"];
						for(var i=0; i < admins.length; i++){
							(function(){
								var email = admins[i];
								res.render('mail-templates/default-receipt', emailBody, function (err, mailBody) {
									if(!err){
										mailer.sendMail('Trove <'+mailer.options.auth.user+'>', email, "Trove Order Receipt", mailBody, [], function(resp) {
											if (resp.error) { console.log(resp.error); }
											console.log('Verification Mail status:-> %s', JSON.stringify(resp.info));
										});
									} else {
										console.log("template render error: %s", err);
										console.log(err);
									}
								});
							})();
						}

						// todo remove this section in production
						updateUserAsset(req.body.data.reference, assetTransaction);
					});
				} else {
					transactionService.updateTransaction({transaction_ref: req.body.data.reference}, {
						logs: assetTransaction.logs+JSON.stringify(verifyResponse),
						status: transactionService.FAILED
					});
				}
			} else {
				var database = new dbInterface.database();
				database.select('payment_auth', {txRef: req.body.data.reference}, function (err, paymentAuth) {
					if(paymentAuth.length > 0){
						paymentAuth = paymentAuth[0];
						if(transactionSuccessful && verifyStatus === 'success' || verifyStatus === 'successful'){
							database.update('payment_auth', {txRef: req.body.data.reference}, { status: transactionService.SUCCESSFUL });
							if(paymentAuth.method_type === 'card' && typeof verifyResponse.data !== 'undefined'){
								var paymentCard = verifyResponse.data['authorization'];
								paymentCard = { // eliminate unused parameters
									// todo confirm if this is necessary
									authorization_code: (paymentCard['reusable']) ? paymentCard.authorization_code : '',
									exp_month: paymentCard["exp_month"], exp_year: paymentCard["exp_year"],
									card_type: paymentCard["brand"], last4: paymentCard["last4"],
									bin: paymentCard["bin"], bank: paymentCard["bank"],
									country_code: paymentCard["country_code"],
									signature: paymentCard["signature"]
								};
								transactionService.addCardPaymentMethod(paymentAuth.user_id, paymentCard);
							} else if(paymentAuth.method_type === 'bank' && typeof verifyResponse.data !== 'undefined'){
								var account = verifyResponse.data['authorization'];
								var bankMeta = { birthday: '', bank_name: '', bank_code: '' };
								try {
									bankMeta = Object.assign({}, bankMeta, JSON.parse(paymentAuth['meta']));
									var bankAccount = {
										brand: account.brand,
										birthday: bankMeta.birthday,
										bank_code: bankMeta.bank_code,
										bank_name: bankMeta.bank_name,
										first_name: '', last_name: '',
										country_code: account.country_code,
										account_number: bankMeta.account_number,
										currency: verifyResponse.data["currency"],
										authorization_code: ''
									};

									// todo confirm if this is necessary
									if(account['reusable']) bankAccount.authorization_code = account['authorization_code'];
									transactionService.addBankAccount(paymentAuth.user_id, bankAccount);
								} catch (err){
									database.update('payment_auth', {txRef: req.body.data.reference}, { status: transactionService.FAILED });
									console.log('Error processing bank account', err);
								}
							}
						} else {
							database.update('payment_auth', {txRef: req.body.data.reference}, { status: transactionService.FAILED });
						}
					}
				});
			}
		});

		var data = Object.assign({}, verifyResponse.data);
		sendResponse({ error: 200, message: 'success', data: data });
	}, function(err){
		console.log(req.body.data.reference+': ', err);
		var errResponse = {error: 417, message: 'expectation failed'};
		if(typeof err !== 'object'){
			errResponse.message = err.toString();
		} else if(typeof err.message !== 'undefined'){
			errResponse.message = err.message;
		} sendResponse(errResponse);
	});
});

module.exports = router;
