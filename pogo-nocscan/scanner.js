var POGOProtos  = require('node-pogo-protos');
var bluebird    = require('bluebird');
var Long        = require('long');
var _           = require('lodash');
var request     = require('request');
var s2          = require('s2-geometry').S2;
var winston     = require('winston');

var core                = require("./core.js");
var scanWorkerFactory   = require("./scanworker.js");
var strategyIdleFactory = require("./strategy.idle.js");
var torHelper           = require("./helper.tor.js");

/**
 * Scanner module.
 */
module.exports = function(config) {
    // Custom logger.
    var logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({
                formatter: function(options) {
                    var result = '';
                    result += (config.name ? ("[" +  config.name + "] ") : '');
                    result += options.level.toUpperCase() + ': ' + (options.message ? options.message : '');
                    result += (options.meta && Object.keys(options.meta).length ? ' ' + JSON.stringify(options.meta) : '' );

                    return result;                    
                },
                level: winston.level
            })
        ]
    });

    var clearIPInfo;
    var activeAccount;
    var activeScanWorker;

    init();

    // ----------------------------------------------------------------------------

    /**
     * Initialize the scanner.
     */
    function init() {

        // Load up notifiers.
        _.each(config.notifiers, function(item, idx) {
            config.notifiers[idx] = core.getPlugin("notifier", item.plugin, item.config);
            config.notifiers[idx].setLogger(logger);
        });

        // Load up locators.
        _.each(config.accounts, function(item, idx) {
            config.accounts[idx].locator = core.getPlugin("locator", item.locator.plugin, item.locator.config);
            config.accounts[idx].locator.setLogger(logger);
        });

        checkIP();
    }


    /**
     * Check host IP.
     */
    function checkIP() {
        // Get a non proxied request to find our clearnet IP.
        request('http://api.ipify.org/?format=json', function(error, res, body) {
            try {
                clearIPInfo = JSON.parse(body);
                logger.info("Looks like our current IP is:", clearIPInfo.ip);
            } catch(err) {
                logger.error("Error checking host IP:", err);
                checkIP();
                return;                
            }   

            startRandomScanner();
        });
    }


    /**
     * Start a scanner using a random account.
     */
    function startRandomScanner() {  
        // Filter out all accounts that are allowed to run in the current hour.
        var currentHour = (new Date()).getHours();
        var applicableAccounts = _.filter(config.accounts, function(acc, idx) {
            var result = false;
            config.accounts[idx].idx = idx;

            _.each(acc.hours, function(hour) { if(currentHour == hour) result = true; });
            return result;
        });

        // If there are now accounts, wait 10 minutes.
        if(applicableAccounts.length == 0) {
            logger.info("No accounts available for the current hour (" + currentHour + "). Waiting...");
            setTimeout(startRandomScanner, 60 * 10 * 1000);
            return;
        }

        // Select the account.
        logger.info("Selecting random account from " + applicableAccounts.length + " applicable accounts.");
        var account = applicableAccounts[rand(applicableAccounts.length)];
        activeAccount = account;

        // Calculate the amount of allowed sequential hours. (min 1, max 3)
        var allowedSeqHours = 1;
        for(var i = 0; i < 2; i++) {
            currentHour++;
            if(_.find(account.hours, function(hour) { return hour == currentHour }) == null)
                break;
            
            allowedSeqHours++;
        }

        // Calculate the time to run a scanner for with this account.
        var timeToRun = (rand((allowedSeqHours * 3600)-3600) + 3600) * 1000;

        // Check the account's proxy, then run an idling scanner with it.
        logger.info("Using account '" + account.username + "' for " + (timeToRun / 60000) + " minutes.");
        proxyCheck(account)
            .then(function proxyresolve() { 
                var strategy = strategyIdleFactory(account, config);
                strategy.setLogger(logger);

                activeScanWorker = scanWorkerFactory(account, timeToRun, strategy, logger);
                activeScanWorker.finishWorkerCallback(function() {
                    activeScanWorker = null;
                    setTimeout(startRandomScanner, 1000);
                })

                strategy.setWorker(activeScanWorker);
                activeScanWorker.startWorker(); 
            }, function proxyreject() {
                // Check if we have a reject method on the proxy resolver. Call it.
                if(!(typeof account.proxy === 'string') && "reject" in account.proxy)
                    account.proxy.reject();

                logger.error("Failed proxy check, moving to next account...");

                if("torconfig" in account)
                    torHelper.newCircuit(function() { setTimeout(startRandomScanner, 1000); }, account, logger);
                else 
                    setTimeout(startRandomScanner, 1000);
            })
            .catch(function(e) {
                logger.error("Exception during proxy check, moving to next account...");
                logger.error(e);

                if("torconfig" in account)
                    torHelper.newCircuit(function() { setTimeout(startRandomScanner, 1000); }, account, logger);
                else 
                    setTimeout(startRandomScanner, 1000);
            });
    }


    /**
     * Check a proxy and make sure we are not getting our real IP leaked.
     */
    function proxyCheck(account) {
        var p = new Promise(function(resolve, reject) {
            var tProxy;

            // If the proxy is a string, use that. If not, generate proxy.
            if("proxy" in account && (typeof account.proxy === 'string'))
                tProxy = account.proxy;
            else if("proxy" in account)
                tProxy = account.proxy.next();

            // Check for allowable no proxy.
            if("allowNoProxy" in account && account.allowNoProxy && (account.proxy == null || account.proxy == "")) {
                resolve();
                return;
            }

            logger.info("Testing proxy:", tProxy);

            // Do a request to ipify under the proxy.
            request({
                method: "GET",
                url: 'http://api.ipify.org/?format=json',
                proxy: tProxy
            }, function(error, res, body) {

                // If we get an HTTP error, reject the promise.
                if (!(!error && res.statusCode == 200)) {
                    logger.error("Could not connect with proxy.");
                    logger.error("Error:", error);

                    if(res != null && "statusCode" in res)
                        logger.info("Status Code:", res.statusCode);

                    reject();
                    return;
                }

                // Check if the response's IP is our clear IP (bad).
                var pIPInfo = JSON.parse(body);
                if(pIPInfo.ip == clearIPInfo.ip) {
                    logger.error("Proxy IP check failed.");
                    reject();
                    return;
                }

                // All else passed, proxy is working.
                logger.info("Proxy appears to work, IP is:", pIPInfo.ip);
                resolve();
            });
        });

        return p;
    }


    /**
     * Get a random int up to a numnber.
     */
    function rand(max) {
        return Math.floor(Math.random() * max);
    }

    
    // Build module.
    return {
        getActiveAccount: function() { return activeAccount; },
        getActiveScanner: function() { return activeScanWorker; }
    };
}