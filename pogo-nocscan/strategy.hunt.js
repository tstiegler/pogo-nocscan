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
    var parent;
    var self;

    var position = waypoints[0];

    var navCount = 0;
    var waypointIndex = 1;

    var speedkmh = 10; // Make the worker go at 10km/h
    var lastScanTime = 0;

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
        // Don't bother navigating on the login call.
        if(isLogin) {
            callbackfunc(position);
            return;
        }

        // Check if we've finished navigating to all waypoints.
        if(waypointIndex == waypoints.length) {
            // Tell the scan worker that we're done.
            // TODO: Figure out how to reference the worker for this strat.
            // since this fails because "parent" is the parent strategy,
            // not the applicable worker.
            parent.finish();
            return;
        }

        callbackfunc(position);

        position = waypoints[waypointIndex];
        waypointIndex++;
       
        // All of this below was kinda stupid.
        // At 30 seconds between traveling straight from one beehive
        // to another, you travel at like 10k/hr.... no biggie.

        /*
        var time = (new Date()).getTime();

        if(navCount == 0) {
            callbackfunc(position);
        } else {
            // Calculate the distance in meters to travel since last scan.
            var timeSinceLastScan = (time - lastScanTime) / 1000;       // Seconds since last scan.
            var speedAsMPS = (randomizeSpeed(speedkmh) * 1000) / 60 / 60                // Speed as meters/second.
            var distanceToTravel = timeSinceLastScan * speedAsMPS;      // Meters to travel this iteration.

            logger.info("Travelling " + distanceToTravel + " meters");

            // Get the new location.
            var newLocation = gpsHelper.moveTowards(position, waypoints[waypointIndex], distanceToTravel);
        

            // If this location is close enough to the next location, increment the waypointIndex.
            if(Math.abs(newLocation.lat - waypoints[waypointIndex].lat) < 0.000005
            && Math.abs(newLocation.lng - waypoints[waypointIndex].lng) < 0.000005) {
                newLocation = waypoints[waypointIndex];
                waypointIndex++;   
            }

            position = newLocation;
            callbackfunc(position);
        }

        lastScanTime = time;
        navCount++;*/
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
     * Randomize the speed a little.
     */
    function randomizeSpeed(inSpeed) {
        return inSpeed - Math.random(); // Just take off a random 0-1km/h.
    }

    // Return module.
    self = {
        shutdown: shutdown,
        getPosition: getPosition,
        handleNearby: handleNearby,
        handleCatchable: handleCatchable,
        setLogger: function(nl) { logger = nl; },
        setParent: function(p) { parent = p; }
    }
    return self;
}