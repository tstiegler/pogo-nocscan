/**
 * Helper module with GPS related methods. 
 */

var s2 = require('s2-geometry').S2;

// Number functions for GPS coord manipulation.
Number.prototype.toRad = function() { return this * Math.PI / 180; }
Number.prototype.toDeg = function() { return this * 180 / Math.PI; }


/**
 * Get position of GPS coordinates, moving towards a given point.
 */
function moveTowards(curLatLng, destLatLng, distance) {       
    // First, check if we are really close to the destination.
    // If so, just return the destination.
    if(haversine(curLatLng.lat, curLatLng.lng, destLatLng.lat, destLatLng.lng) > distance) {
        return {
            lat: destLatLng.lat,
            lng: destLatLng.lng
        }
    }

    // If not, calculate distance, bearing and destination coordinates.
    var dist = distance / 6371;
    var brng = getBearing(curLatLng.lat, curLatLng.lng, destLatLng.lat, destLatLng.lng);

    var lat1 = curLatLng.lat.toRad();
    var lon1 = curLatLng.lng.toRad();
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + 
                        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));
    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                                Math.cos(lat1), 
                                Math.cos(dist) - Math.sin(lat1) *
                                Math.sin(lat2));
    // Check for errors.
    if (isNaN(lat2) || isNaN(lon2)) return {lat: 0, lng: 0};

    // Return resulting coordinates.
    return {
        lat: lat2,
        lng: lon2
    };
}


/**
 * Get the bearing from one GPS coordinate to another.
 */
function getBearing(startLat,startLong,endLat,endLong){
    startLat = startLat.toRad();
    startLong = startLong.toRad();
    endLat = endLat.toRad();
    endLong = endLat.toRad();

    var dLong = endLong - startLong;

    var dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
    if (Math.abs(dLong) > Math.PI){
    if (dLong > 0.0)
        dLong = -(2.0 * Math.PI - dLong);
    else
        dLong = (2.0 * Math.PI + dLong);
    }

    return ((Math.atan2(dLong, dPhi)).toDeg() + 360.0) % 360.0;
}


/**
 * Get disance between two GPS points.
 */
function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371; // km 
    //has a problem with the .toRad() method below.
    var x1 = lat2-lat1;
    var dLat = x1.toRad();  
    var x2 = lon2-lon1;
    var dLon = x2.toRad();  
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                    Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
                    Math.sin(dLon/2) * Math.sin(dLon/2);  
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; 

    return d;
}


/**
 * Generate a random GPS float value between two numbers
 */
function randGPSFloatBetween(min, max) {
    return parseFloat((Math.random()*(max-min)+min).toFixed(10));
}


/**
 * Get a fuzzed location, randomized by 0.000009.
 */
function fuzzedLocation(latlng) {
    return {
        lat: parseFloat((latlng.lat + randGPSFloatBetween(-0.0000009, 0.0000009)).toFixed(10)),
        lng: parseFloat((latlng.lng + randGPSFloatBetween(-0.0000009, 0.0000009)).toFixed(10))
    };
}


// Return module.
module.exports = {
    getBearing: getBearing,
    haversine: haversine,
    fuzzedLocation: fuzzedLocation,
    moveTowards: moveTowards
}