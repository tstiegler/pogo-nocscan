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


/**
 * Evenly split an array into x chunks. (As best it can)
 */
function evenSplitArray(arr, numChunks) {

    var result = [];
    
    var elePerChunk = arr.length / numChunks;
    var startIdxs = [];
    for(var i = 0; i < numChunks; i++) {
        startIdxs.push(Math.ceil(i * elePerChunk));
    }

    _.each(startIdxs, function(start, workerIndex) {
        var stopIndex = (workerIndex == (startIdxs.length - 1)) ? -1 : startIdxs[workerIndex + 1];
        if(stopIndex == -1)
            stopIndex = arr.length;

        var workerChunk = [];
        for(var i = start; i < stopIndex; i++) {
            workerChunk.push(arr[i]);
        }

        result.push(workerChunk);
    });

    return result; 
}


/**
 * Get the beehive for a given S2 cell and split it evenly into x chunks.
 */
function distributeS2Beehive(corners, numChunks) {
    var s2scanBeehive = cornersToBeehive(corners);
    return evenSplitArray(s2scanBeehive, numChunks);  
}

module.exports = {
    cornersToBeehive: cornersToBeehive,
    distributeS2Beehive: distributeS2Beehive
};