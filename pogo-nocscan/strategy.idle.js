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

/**
 * Scan strategy object, will idle on a configured location and report on
 * nearby sightings. (TODO: Eventually this will spin up sub-workers to scan
 * the given s2 cell/nearby radius intersection in its entirety)
 */
module.exports = function(account, config) {
    var parent;
    var self;

    var warningNotifications = [];
    var catchableNotifications = [];
    var logger = winston;

    var huntQueue = [];
    var huntWorkers = [];
    var huntersActive = false;

    // ------------------------------------------------------------------------

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
                        _.each(config.notifiers, function(notifier) { notifier.sendMessage(pokemonName + " nearby! " + displayLink); });
                        logger.info("Nearby: " + pokemonName);

                        // Add to hunt queue.
                        if("huntScanners" in account && account.huntScanners.length > 0)
                            huntQueue.push(poke);
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

            // Add to the parent's known encounters.
            if(parent)
                parent.addEncounter(poke);

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
                        _.each(config.notifiers, function(notifier) { notifier.sendMessage(pokemonName + " found! " + displayLink); });
                        logger.info("Catchable: " + pokemonName);
                    }
                }
            });          
        });         
    }


    /**
     * Poll for hunt targets.
     */
    function huntPoll() {
        if(!huntersActive && huntQueue.length > 0) {
            var poke = huntQueue.shift();
            var encounterId = poke.encounter_id;
            var s2bounds = s2.S2Cell.FromHilbertQuadKey(poke.cellKey).getCornerLatLngs();

            var hasWarned = false;
            _.each(catchableNotifications, function(eid) { if(encounterId == eid) hasWarned = true; });

            if(!hasWarned) {
                huntersActive = true;
                
                _.each(account.huntScanners, function(scanAccount) {
                    // Create the hunt strategy instance for this account.
                    var huntstrat = huntStratFactory(scanAccount, config);
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

                    // Get list of scan points for the given cell and divide them amongst the workers.
                    var s2scanBeehive = s2beehiveHelper.cornersToBeehive(s2bounds);

                    // TODO: Split array amongst workers.


                    // Create worker.
                    var scanWorker = scanWorkerFactory(scanAccount, 1080, huntstrat, huntlogger);
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

    }


    // Return module.
    self = {
        getPosition: getPosition,
        handleNearby: handleNearby,
        handleCatchable: handleCatchable,
        setLogger: function(nl) { logger = nl; },
        setParent: function(p) { parent = p; }
    }
    return self;
}