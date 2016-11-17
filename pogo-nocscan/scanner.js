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
                }
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

        // Get a non proxied request to find our clearnet IP.
        request('http://ipinfo.io', function(error, res, body) {
            clearIPInfo = JSON.parse(body);
            logger.info("Looks like our current IP is:", clearIPInfo.ip);

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

        logger.info("Selecting random account from " + applicableAccounts.length + " applicable accounts.");

        var account = applicableAccounts[rand(applicableAccounts.length)];
        activeAccount = account;

        // Calculate the time to run a scanner for with this account. (Random seconds between 1 hour and 3 hours)
        var timeToRun = (rand(10800-3600) + 3600) * 1000;

        // Check the account's proxy, then run an idling scanner with it.
        logger.info("Using account '" + account.username + "' for " + (timeToRun / 60000) + " minutes.");
        proxyCheck(account.proxy, account)
            .then(function() { 
                var strategy = strategyIdleFactory(account, config);
                strategy.setLogger(logger);

                activeScanWorker = scanWorkerFactory(account, timeToRun, strategy, logger);
                activeScanWorker.finishWorkerCallback(function() {
                    setTimeout(startRandomScanner, 1000);
                })

                strategy.setParent(activeScanWorker);
                activeScanWorker.startWorker(); 
            })
            .catch(function(e) {
                logger.error("Failed proxy check, moving to next account...");
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
    function proxyCheck(proxy, account) {
        var p = new Promise(function(resolve, reject) {
            logger.info("Testing proxy:", proxy);

            // Do a request to IPInfo under the proxy.
            request({
                method: "GET",
                url: 'http://ipinfo.io',
                proxy: proxy
            }, function(error, res, body) {
                // Check for allowable no proxy.
                if("allowNoProxy" in account && account.allowNoProxy && (account.proxy == null || account.proxy == "")) {
                    resolve();
                    return;
                }

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
