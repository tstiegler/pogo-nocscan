var _ = require("lodash");
var winston = require("winston");

function proxyResolverFactory(proxyList) {
    var currentProxy;
    var rejectedProxies = [];

    /**
     * Get the next proxy to use.
     */
    function next() {
        // Get all of the non rejects.
        var nonrejectedProxies = _.filter(proxyList, function(proxy) {
            return (_.find(rejectedProxies, function(rejected) { return proxy == rejected; }) == null);
        });

        // Show error if there are none left.
        if(nonrejectedProxies.length == 0) {
            winston.error("No non-rejected proxies left to use.");
            return;
        }

        // Pick one at random.
        currentProxy = nonrejectedProxies[Math.floor(Math.random() * nonrejectedProxies.length)].trim();
        return currentProxy;
    }


    /**
     * Get the currently selected proxy.
     */
    function get() {
        if(currentProxy == null)
            return next();
        else
            return currentProxy;
    }


    /**
     * Reject the currently selected proxy.
     */
    function reject() {
        rejectedProxies.push(currentProxy);
    }

    // Return resolver instance.
    return {
        next: next,
        get: get,
        reject: reject
    };
};

module.exports = proxyResolverFactory;