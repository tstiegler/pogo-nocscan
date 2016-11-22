/**
 * This is just a basic key value pair cache.
 */

var cache = {};

module.exports = {
    get: function(key) { if(key in cache) return cache[key]; else return null; },
    set: function(key, value) { cache[key] = value; }
}