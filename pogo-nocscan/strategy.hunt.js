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
    var parent;
    var self;

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
    }


    /**
     * Handle map request cell's catchable lists. 
     */
    function handleCatchable(catchable_pokemons, cellKey) {
        // Check all nearby pokemon.
        _.each(catchable_pokemons, function(poke) {

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

            // Check for huntable pokemon.
            _.each(config.huntIds, function(id) { 
                if(pokemonId == id) {
                    
                }
            });          
        });         
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