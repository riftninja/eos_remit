/**
 * INIT CONFIG
 * Implement Runtime Configurations Here
 */
var init = function(){
    String.prototype.toCamelCase = function() {
        return this.toLowerCase().replace(/\b[a-z]/g, function(letter) {
            return letter.toUpperCase();
        });
    };
	String.prototype.startsWith = function(suffix) {
		return this.indexOf(suffix, 0) !== -1;
	};
	String.prototype.endsWith = function(suffix) {
		return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};
};

var extraInit = function(){};

/**
 * GET DATA FROM CONFIG
 * get data from the config file <app-config.json> located in root directory
 * @param config - specify the configuration to get, default gets a config
 */
var getConfig = function (config){
    var path = process.env.ENVIRONMENT === 'production' ? './app-production.json' : './app-config.json';
    var appConfig = require(path);

    if(arguments.length > 0){
        return appConfig[config];
    } else {
        return appConfig;
    }
};

module.exports = {
    init: init,
    extraInit: extraInit,
    getConfig: getConfig
};