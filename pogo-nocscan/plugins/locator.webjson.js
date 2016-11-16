var webJsonLocator = function(config) {
    var logger      = require("winston");
    var request     = require("request");

    /**
     * Get GPS location from URL.
     */
    function getLocation(callback, error) {
        logger.info("Getting GPS location...");

        downloadToString(config.url, function(gpsData) { 
            try {                       
                gpsData = JSON.parse(gpsData);
                gpsData.lat = parseFloat(gpsData.lat);
                gpsData.lng = parseFloat(gpsData.lng);
                logger.info("Downloaded GPS data: ", gpsData);

                if("offsetlat" in config && "offsetlng" in config) {
                    gpsData.lat += parseFloat(config.offsetlat);
                    gpsData.lng += parseFloat(config.offsetlng);    
                }

                // Extend original point data.
                var location = {lat: gpsData.lat, lng: gpsData.lng};           
                callback(location);           
            } catch(err) {
                error(err);
            } 
        }, error);
    }


    /**
     * Download web request to string.
     */
    function downloadToString(url, callback, error) {
        try {
            request(url, function(reqerr, response, body) {
                if (!reqerr && response.statusCode == 200) {
                    try {
                        callback(body);
                    } catch(err) {
                        error(err);
                    }
                } else {
                    error(reqerr);
                }
            });
        } catch(err) {            
            error(err);
        } 
    } 

    // Return module object.
    return {
        getLocation: getLocation,
        setLogger: function(nl) { logger = nl; }
    }
}

module.exports = webJsonLocator