var s2      = require("s2-geometry").S2;
var beehive = require("beehive-cluster");
var _       = require("lodash");


/**
 * Convert a s2 cell ID to a list of GPS coords, where at 70m, is completely
 * covered. Useful for creating a scan plan of a given cell.
 */
function cornersToBeehive(corners) {
    // Calculate the midpoint of the cell.
    // TODO: Fix this, because this is horrible and can glitch in certain
    // conditions.
    var lat = (corners[0].lat + corners[3].lat) / 2;
    var lng = (corners[0].lng + corners[1].lng) / 2;

    // Calculate the beehive locations at the midpoint.
    var prebeehiveData = beehive.mkHive({lat: lat, lon: lng}, 2, 70).toArray();
    var beehiveData = [];
    _.each(prebeehiveData, function(bh) {
        beehiveData.push({
            lat: bh[0],
            lng: bh[1]
        });
    })

    return beehiveData;
}   

module.exports = {
    cornersToBeehive: cornersToBeehive
};