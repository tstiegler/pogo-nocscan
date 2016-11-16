var staticLocator = function(latlng) {
    var logger = require("winston");

    /**
     * Get GPS location from URL.
     */
    function getLocation(callback, error) {
        logger.info("Using static location:", latlng);

        var response = {
            lat: latlng.lat,
            lng: latlng.lng
        };

        if("fuzzing" in latlng) {
            response.lat += generateRandomNumber(latlng.fuzzing * -1, latlng.fuzzing);
            response.lng += generateRandomNumber(latlng.fuzzing * -1, latlng.fuzzing);
        }

        callback(response);
    }

    function generateRandomNumber(min, max) {
    	return Math.random() * (max - min) + min;
    };

    // Return module object.
    return {
        getLocation: getLocation,
        setLogger: function(nl) { logger = nl; }
    }    
}

module.exports = staticLocator