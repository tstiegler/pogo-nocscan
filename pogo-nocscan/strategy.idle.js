var POGOProtos  = require('node-pogo-protos');
var bluebird    = require('bluebird');
var Long        = require('long');
var _           = require('lodash');
var s2          = require('s2-geometry').S2; 
var pogobuf     = require('pogobuf');
var winston     = require('winston');    

/**
 * Scan strategy object, will idle on a configured location and report on
 * nearby sightings. (TODO: Eventually this will spin up sub-workers to scan
 * the given s2 cell/nearby radius intersection in its entirety)
 */
module.exports = function(account, config) {
    var warningNotifications = [];
    var catchableNotifications = [];
    var logger = winston;

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
            var pokemonId = poke.pokemon_id;
            var pokemonName = pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, poke.pokemon_id);
            var encounterId = poke.encounter_id;
            var spawnPoint = poke.spawn_point_id;
            var position = {
                lat: poke.latitude,
                lng: poke.longitude
            };

            // Check for huntable pokemon.
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


    // Return module.
    return {
        getPosition: getPosition,
        handleNearby: handleNearby,
        handleCatchable: handleCatchable,
        setLogger: function(nl) { logger = nl }
    }
}