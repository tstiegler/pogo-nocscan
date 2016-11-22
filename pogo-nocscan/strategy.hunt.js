var POGOProtos  = require('node-pogo-protos');
var bluebird    = require('bluebird');
var Long        = require('long');
var _           = require('lodash');
var s2          = require('s2-geometry').S2; 
var pogobuf     = require('pogobuf');
var winston     = require('winston');    

var gpsHelper   = require("./helper.gps.js");

/**
 * Scan strategy object, will idle on a configured location and report on
 * nearby sightings. (TODO: Eventually this will spin up sub-workers to scan
 * the given s2 cell/nearby radius intersection in its entirety)
 */
module.exports = function(account, config, waypoints, encounterId) {
    var self;
    var parent;
    var worker;

    var position = waypoints[0];
    var waypointIndex = 0;

    var logger = winston;

    // ------------------------------------------------------------------------

    /**
     * Handle shutdown requests.
     */
    function shutdown() {
        // Nothing needs to be handled here.
    }


    /**
     * Stay stationaty, the client handles location fuzzing.
     */
    function getPosition(callbackfunc, errorfunc, isLogin) {
        // Check if we've finished navigating to all waypoints.
        if(waypointIndex == waypoints.length) {
            // Tell the scan worker that we're done.
            if(worker)
                worker.finish();
            return;
        }

        callbackfunc(waypoints[waypointIndex]);

        // Only move to the next waypoint index if this is NOT a login
        // request that is asking for the position.
        if(!isLogin)
            waypointIndex++;    
    }


    /**
     * Handle map request cell's nearby lists.
     */
    function handleNearby(nearby_pokemons, cellKey, position) {
        // Hunters don't care about nearby. Only catchable.
    }


    /**
     * Handle map request cell's catchable lists. 
     */
    function handleCatchable(catchable_pokemons, cellKey) {
        // Call handle catchable on the parent strategy.
        // This will handle notifications.
        parent.handleCatchable(catchable_pokemons, cellKey);

        // Check all nearby pokemon.
        _.each(catchable_pokemons, function(poke) {
            if(poke.encounter_id == encounterId) {
                // FOUND IT!!!
                parent.huntResult();
            }          
        });         
    }


    /**
     * Handle signal that the previous location wasn't scanned.
     */
    function backstep() {
        // Move to the previous waypoint index.
        waypointIndex--;
    }


    // Return module.
    self = {
        shutdown: shutdown,
        getPosition: getPosition,
        handleNearby: handleNearby,
        handleCatchable: handleCatchable,
        backstep: backstep,
        setLogger: function(nl) { logger = nl; },
        setParent: function(p) { parent = p; },
        setWorker: function(w) { worker = w; }
    }
    return self;
}