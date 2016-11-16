/**
 * Helper module for handling named timeouts.
 * (Helps to prevent double timeouts, which i've had issues with)
 */
var timeoutDict = {};

module.exports = {
    /**
     * Set a named timeout.
     */
    setTimeout: function(id, func, time) {
        if(id in timeoutDict)
            clearTimeout(timeoutDict[id]);
        
        timeoutDict[id] = setTimeout(func, time);
        return timeoutDict[id];
    }
}