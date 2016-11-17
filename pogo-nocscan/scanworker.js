var POGOProtos      = require('node-pogo-protos');
var pogoSignature   = require('node-pogo-signature');
var bluebird        = require('bluebird');
var Long            = require('long');
var _               = require('lodash');
var request         = require('request');
var s2              = require('s2-geometry').S2;
var pogobuf         = require('pogobuf');
var winston         = require('winston');

var gpsHelper       = require("./helper.gps.js");
var tutorialHelper  = require("./helper.tutorial.js");
var timeoutHelper   = require("./helper.timeout.js");
var torHelper       = require("./helper.tor.js");

/**
 * Start scanner with a given location.
 */
module.exports = function(account, timeToRun, strategy, logger) {
    var self;

    var finishWorkerCallback;
    var isAuthenticated = false;
    var client = getClient();

    var scanTimeout;
    var lastMapObjects;
    var scanDelay = 30;
    var knownEncounters = {};
 
    // ------------------------------------------------------------------------

    /**
     * Kick off the scan worker, log in and start scanning.
     */
    function startWorker() {
        logger.info("Logging in with: ", account.username);

        // Login.
        getLoginMethod().login(account.username, account.password)
            .catch(function(err) {
                logger.error("Login error, canceling worker", err);
                finish();
            })
            .then(token => {
                if(token == null)
                    return;

                logger.info("Logged into PTC with token:", token);
                isAuthenticated = true;
                client.setAuthInfo('ptc', token);            

                strategy.getPosition(function(position) {
                    position = gpsHelper.fuzzedLocation(position);
                    logger.info("Setting position to:", position);
                    client.setPosition(position.lat, position.lng);
                    scanTimeout = timeoutHelper.setTimeout(account.username + "-scan", initClientStep1, 15000);
                }, function() {
                    scanTimeout = timeoutHelper.setTimeout(account.username + "-scan", initClientStep1, scanDelay * 1000);
                }); 
            });

        // Cancel the timeout after we are finished running.
        timeoutHelper.setTimeout(account.username + "-end", function() {
            logger.info("Cancelling scan worker...");    
            finish();
        }, timeToRun);
    }


    /**
     * Finish the scan worker.
     */
    function finish() {
        if(scanTimeout != null)
            clearTimeout(scanTimeout);

        if(finishWorkerCallback != null)
            finishWorkerCallback();
    }


    /**
     * Add a known encounter to the list.
     */
    function addEncounter(encounter) {
        var currentTime = (new Date().getTime());
    
        // Before we do anything, clean up the old encounters.
        _.forOwn(knownEncounters, function(value, key) {
            // Check for removal, 30 min. 
            // Some encounters can apparently be 1hr, but whatever.
            // Update seconds left for those not getting removed.
            if(currentTime - value.timestamp > 1800000)                 
                delete knownEncounters[key];
            else
                knownEncounters[key].secondsleft = 1800 - ((currentTime -  knownEncounters[key].timestamp) / 1000);     
        });

        // Check if we already have it, if so, update it (but not the timestamp)
        if(encounter.encounter_id in knownEncounters) {
            knownEncounters[encounter.encounter_id].encounter = encounter;
            knownEncounters[encounter.encounter_id].secondsleft = 1800 - ((currentTime -  knownEncounters[encounter.encounter_id].timestamp) / 1000);
            return;
        }

        // Add it with the current timestamp.
        knownEncounters[encounter.encounter_id] = {
            timestamp: currentTime,
            secondsleft: 1800,
            encounter: encounter
        }
    }


    /**
     * Get the client
     */
    function getClient() {
        var result = new pogobuf.Client();
        
        if("proxy" in account && (typeof account.proxy === 'string'))
            result.setProxy(account.proxy);
        else if("proxy" in account)
            result.setProxy(account.proxy.get());
            
        return result;        
    }

    /**
     * Get the login method.
     */
    function getLoginMethod() {
        var result = new pogobuf.PTCLogin();

        if("proxy" in account && (typeof account.proxy === 'string'))
            result.setProxy(account.proxy);
        else if("proxy" in account)
            result.setProxy(account.proxy.get());

        return result;
    }


    /**
     * Step 1 of the modified login process.
     */
    function initClientStep1() {
        logger.info("Initializing worker...");

        client.signatureBuilder = new pogoSignature.Builder();
        client.lastMapObjectsCall = 0;
        client.endpoint = 'https://pgorelease.nianticlabs.com/plfe/rpc';

        client.batchStart()
            .getPlayer()
            .checkChallenge()
            .batchCall()
            .then(function(initResponse) {
                logger.info("Init [1/2]");

                // Run the tutorial helper, move to next step when complete.
                tutorialHelper(
                    client, 
                    account, 
                    initResponse[0].player_data.tutorial_state, 
                    initClientStep2,
                    logger
                );
            }, function(err) {
                logger.error("Error during initialization:", err);

                if("torconfig" in account)
                    torHelper.newCircuit(finish, account, logger);                                          
            });   
    }


    /**
     * Step 2 of the modified login process.
     */
    function initClientStep2() {
        client.batchStart()
            .downloadRemoteConfigVersion()
            .checkChallenge()
            .getHatchedEggs()
            .getInventory()
            .checkAwardedBadges()
            .downloadSettings()
            .batchCall()
            .then(function(initResponse) {
                logger.info("Init [2/2]");

                // Fake the expected process inital data call and start performing scans.
                client.processInitialData([0, 0, 0, 0, initResponse[5]]);
                scanTimeout = timeoutHelper.setTimeout(account.username + "-scan", performScan, scanDelay * 1000);
            })
    }


    /**
     * Perform a scan at the given location.
     */
    function performScan() {
        // Move to the next location.
        strategy.getPosition(function(position) {
            position = gpsHelper.fuzzedLocation(position);
            logger.info("Setting position to: ", position);
            client.setPosition(position.lat, position.lng);
            checkNearby(position); 
        }, function() {
            scanTimeout = timeoutHelper.setTimeout(account.username + "-scan", performScan, scanDelay * 1000);
        });
    }


    /**
     * Handle RPC fails.
     */
    function RPCFail() {
        // Attempt restart.                       
        clearTimeout(scanTimeout);

        isAuthenticated = false;
        client = getClient();
        startWorker();
    }


    /**
     * Check nearby.
     */
    function checkNearby(pos) {
        // Make sure we're properly authenticated before attempting to make an API call.        
        if(!isAuthenticated) {
            logger.error("Is not authenticated, will not call API.");
            return;
        }

        logger.info("Checking nearby...");

        // Build a cell list, and since-timestamp list.
        var cellIDs = pogobuf.Utils.getCellIDs(pos.lat, pos.lng);
        var sinceTimestamps = Array(cellIDs.length).fill(0);

        // Create the call.
        var mapObjectCall = client.batchStart()
            .getMapObjects(cellIDs, sinceTimestamps)
            .checkChallenge()
            .getHatchedEggs()
            .getInventory()
            .checkAwardedBadges()
            .downloadSettings()
            .batchCall()
            .catch(RPCFail);

        return bluebird.resolve(mapObjectCall).then(result => {
            if(result == null) {
                logger.error("Received null mapobject result...");
                return [];
            }

            var mapObjects = result[0];
            lastMapObjects = mapObjects;

            var catchableCount = 0;
            var nearbyCount = 0;

            _.each(mapObjects.map_cells, function(cell, idx) {
                nearbyCount += cell.nearby_pokemons.length;
                catchableCount += cell.catchable_pokemons.length;
            })  

            logger.info("MapObject Call:");
            logger.info("  " + catchableCount + " catchable pokemon.");
            logger.info("  " + nearbyCount + " nearby pokemon.");

            if(catchableCount == 0 && nearbyCount == 0)
                logger.error("Possible softban.");

            // Set the timeout to scan again.
            scanTimeout = timeoutHelper.setTimeout(account.username + "-scan", performScan, scanDelay * 1000);
            
            return mapObjects.map_cells;
        }).each(cell => {
            var cellKey = s2.idToKey(cell.s2_cell_id.toString());

            strategy.handleNearby(cell.nearby_pokemons, cellKey, {lat: client.playerLatitude, lng: client.playerLongitude});
            strategy.handleCatchable(cell.catchable_pokemons, cellKey);
        }); 
    }


    // Return worker instance.
    self = {
        startWorker: startWorker,
        addEncounter: addEncounter,
        finishWorkerCallback: function(cb) {
            finishWorkerCallback = cb;
        },
        getLastMapObjects: function() { return lastMapObjects; },
        getKnownEncounters: function() { return knownEncounters; },
        getPosition: function() { 
            return {
                lat: client.playerLatitude,
                lng: client.playerLongitude
            };
        }
    };
    return self;
}