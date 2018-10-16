var configurations = require('../app-config');

/**
 * HTTP REQUEST CLASS
 * make http request calls to global API
 */
var httpRequest = function(options){
    if(arguments.length < 1){
        options = configurations.getConfig('http.request');
    }
    this.options = options;

    this.setOptions = function(options){
        this.options = options;
    };

    this.addOption = function(key, value){
        this.options[key] = value;
    };

    this.addHeader = function(key, value){
        if(!this.options.hasOwnProperty("headers")){
            this.options.headers = {};
        }
        this.options.headers[key] = value;
    };

    this.get = function(params, successCallback, errorCallback){
        this.request('GET', params, successCallback, errorCallback);
    };

    this.post = function(params, successCallback, errorCallback){
        this.request('POST', params, successCallback, errorCallback);
    };

    this.request = function(method, params, successCallback, errorCallback){
	    var options = this.options;
	    options.method = method;

	    var http = options.secure ? require('https') : require('http');
	    options.port = options.secure ? 443 : options.port;

        params = JSON.stringify(params);
        if(!this.options.hasOwnProperty("headers"))
            this.options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        // options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(params);

        var request = http.request(options, function(res) {
            // res.setEncoding('utf8');
            var response = "";
            res.on('data', function (chunk) {
                response += chunk;
            });
            res.on('end', function(){
                try{
                    response = JSON.parse(response);
                } catch (e){}
                successCallback(response);
            });
        }).on('error', function(e) {
            errorCallback(e);
        });
        // write data to request body
        request.write(params);
        request.end();
    };
};

// noinspection SpellCheckingInspection
var bitlyUrlShortener = function(longUrl, successCallback, errorCallback){
	// noinspection SpellCheckingInspection
	var bitlyConfig = configurations.getConfig("bitly.config");

	var httpRequest = new this.httpRequest();
	httpRequest.addOption("secure", true);
	httpRequest.addOption("host", bitlyConfig.host);
	httpRequest.addOption("path", bitlyConfig.path+'?access_token='+bitlyConfig['access_token']+'&longUrl='+longUrl);

	httpRequest.get({}, function(resp){
		if(resp['status_code'] === 200){
			successCallback(resp.data);
		} else {
			errorCallback(resp);
		}
	}, function(err){
		errorCallback(err);
	});
};

module.exports = { httpRequest: httpRequest, bitlyUrlShortener: bitlyUrlShortener };