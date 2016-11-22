var POGOProtos  = require('node-pogo-protos');
var bluebird    = require('bluebird');
var Long        = require('long');
var _           = require('lodash');
var s2          = require('s2-geometry').S2; 
var pogobuf     = require('pogobuf');
var winston     = require('winston');    

var huntStratFactory    = require("./strategy.hunt.js");
var scanWorkerFactory   = require("./scanworker.js");
var s2beehiveHelper     = require("./helper.s2beehive.js");
var notiHelper          = require("./helper.notifications.js");

/**
 * Scan strategy object, will idle on a configured location and report on
 * nearby sightings. If subworkers have been configured, this will spin off
 * new workers to find encounters (specified in config.huntIds) in nearby.
 */
module.exports = function(account, config) {
    var self;
    var parent;
    var worker;
    
    var warningNotifications = [];
    var catchableNotifications = [];
    var logger = winston;

    var huntQueue = [];
    var huntWorkers = [];
    var huntersActive = false;

    var huntPollInterval;

    if("huntScanners" in account && account.huntScanners.length > 0) {
        huntPollInterval = setInterval(huntPoll, 10000);
    }

    // ------------------------------------------------------------------------

    /**
     * Handle shutdown requests.
     */
    function shutdown() {
        if(huntPollInterval != null)
            clearInterval(huntPollInterval);
    }


    /**
     * Stay stationaty, the client handles location fuzzing.
     */
    function getPosition(callbackfunc, errorfunc) {
        account.locator.getLocation(callbackfunc, errorfunc);
    }


    /**
     * Handle map request cell's nearby lists.
     */
    function handleNearby(nearby_pokemons, cellKey, position) {
        if("catchableOnly" in config && config.catchableOnly)
            return;

        // Check all nearby pokemon.
        _.each(nearby_pokemons, function(poke) {
            poke.cellKey = cellKey;

            var pokemonId = poke.pokemon_id;
            var pokemonName = pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, poke.pokemon_id);
            var encounterId = poke.encounter_id;     

            // Check for huntable pokemon.
            _.each(config.huntIds, function(id) { 
                if(pokemonId == id) {
                    var hasWarned = false;
                    _.each(warningNotifications, function(eid) { if(encounterId == eid) hasWarned = true; });

                    if(!hasWarned) {
                        warningNotifications.push(encounterId);

                        // Create a json object with scan location and cell bounds.
                        var displayLink = "https://pogosuite.com/show-s2.html#" + JSON.stringify({
                            nearby: position,
                            s2bounds: s2.S2Cell.FromHilbertQuadKey(cellKey).getCornerLatLngs()
                        });

                        // Send notifications immediately.
                        notiHelper.sendMessage(config, pokemonName + " nearby! " + displayLink);
                        logger.info("Nearby: " + pokemonName);

                        // Add to hunt queue.
                        if("huntScanners" in account && account.huntScanners.length > 0) {
                            logger.info("Adding to hunt queue.");
                            huntQueue.push(poke);
                        }
                    }
                }
            });
        });
    }


    /**
     * Handle map request cell's catchable lists. 
     */
    function handleCatchable(catchable_pokemons, cellKey) {
        // Check all nearby pokemon.
        _.each(catchable_pokemons, function(poke) {
            poke.cellKey = cellKey;

            // Add to the workers's known encounters.
            if(worker)
                worker.addEncounter(poke);

            var pokemonId = poke.pokemon_id;
            var pokemonName = pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, poke.pokemon_id);
            var encounterId = poke.encounter_id;
            var spawnPoint = poke.spawn_point_id;
            var position = {
                lat: poke.latitude,
                lng: poke.longitude
            };

            // Check for catchable pokemon that we may be interested in.
            _.each(config.huntIds, function(id) { 
                if(pokemonId == id) {
                    var hasWarned = false;
                    _.each(catchableNotifications, function(eid) { if(encounterId == eid) hasWarned = true; });

                    if(!hasWarned) {
                        catchableNotifications.push(encounterId);

                        var displayLink = "http://maps.google.com/maps?z=12&t=m&q=loc:" + position.lat + "+" + position.lng;

                        // Send notifications immediately.
                        notiHelper.sendMessage(config, pokemonName + " found! " + displayLink);
                        logger.info("Catchable: " + pokemonName);
                    }
                }
            });          
        });         
    }


    /**
     * Handle signal that the previous location wasn't scanned.
     */
    function backstep() {
        // Idle scanner's don't care.
    }


    /**
     * Poll for hunt targets.
     */
    function huntPoll() {
        // Check if all current workers are finished (can happen if the hunted
        // pokemon despawns before we find it). If so, manually refresh
        // the hunting vars.
        if(_.find(huntWorkers, function(worker) { return !worker.isFinished() }) == null) {
            huntWorkers = [];
            huntersActive = false;
        }

        // Check if we have an available encounter to hunt for.
        
        if(!huntersActive && huntQueue.length > 0) {
            var poke = huntQueue.shift();
            var encounterId = poke.encounter_id;
            var s2bounds = s2.S2Cell.FromHilbertQuadKey(poke.cellKey).getCornerLatLngs();

            logger.info("Taking encounter from hunt queue:", encounterId);

            var hasWarned = false;
            _.each(catchableNotifications, function(eid) { if(encounterId == eid) hasWarned = true; });

            if(!hasWarned) {
                huntersActive = true;
                
                // Get list of scan points for the given cell and divide them amongst the workers.
                var splitBeehive = s2beehiveHelper.distributeS2Beehive(s2bounds, account.huntScanners.length);

                _.each(account.huntScanners, function(scanAccount, idx) {
                    // Create the hunt strategy instance for this account.
                    var huntstrat = huntStratFactory(scanAccount, config, splitBeehive[idx], encounterId);
                    var huntlogger = new (winston.Logger)({
                        transports: [
                            new (winston.transports.Console)({
                                formatter: function(options) {
                                    var result = '';
                                    result += (config.name ? ("[" +  config.name + "-" + scanAccount.username + "] ") : '');
                                    result += options.level.toUpperCase() + ': ' + (options.message ? options.message : '');
                                    result += (options.meta && Object.keys(options.meta).length ? ' ' + JSON.stringify(options.meta) : '' );

                                    return result;                    
                                },
                                level: winston.level
                            })
                        ]
                    });

                    huntstrat.setLogger(huntlogger);
                    huntstrat.setParent(self);

                    // Create worker.
                    var scanWorker = scanWorkerFactory(config, scanAccount, 1080000, huntstrat, huntlogger);
                    huntstrat.setWorker(scanWorker);
                    scanWorker.startWorker();

                    // Keep track of workers.
                    huntWorkers.push(scanWorker);
                })
            }
        }
    }

    /**
     * Handle getting a hunt result.
     */
    function huntResult() {
        // At this point, we've found the encounter and has been reported
        // through a call to handleCatchable. At this point, we just need
        // to shut all the scanners down.
        logger.info("Hunt result obtained, killing subworkers.");
        _.each(huntWorkers, function(worker) {
            worker.finish();
        })
        huntWorkers = [];
        huntersActive = false;
    }


    // Return module.
    self = {
        shutdown: shutdown,
        getPosition: getPosition,
        handleNearby: handleNearby,
        handleCatchable: handleCatchable,
        backstep: backstep,
        huntResult: huntResult,
        getHuntWorkers: function() { return huntWorkers; },
        setLogger: function(nl) { logger = nl; },
        setParent: function(p) { parent = p; },
        setWorker: function(w) { worker = w; }
    }
    return self;
}