var gpsHelper = require("./helper.gps.js");

var speedLog = {};
var MAX_SPEED_KMPH = 20;

function checkPosition(account, position, logger) {
    var timestamp = (new Date()).getTime();

    if(account.username in speedLog) {
        var logEntry = speedLog[account.username];
        var timespan = timestamp - logEntry.timestamp;

        var timespanHours = timespan / 1000 / 60 / 60;
        var distanceKm = gpsHelper.haversine(logEntry.position.lat, logEntry.position.lng, position.lat, position.lng) / 1000;

        var kmph = distanceKm / timespanHours;

        if(kmph > MAX_SPEED_KMPH) {
            logger.info("Going too fast!")
            return false;
        } else
            logger.info("Speed:", kmph + "km/h");
    }

    speedLog[account.username] = {
        timestamp: timestamp,
        position: position
    };

    return true;
}

var speedBanHelper = {
    checkPosition: checkPosition
}

module.exports = speedBanHelper;