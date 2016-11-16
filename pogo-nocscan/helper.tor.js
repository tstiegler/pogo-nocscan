var winston = require('winston'); 

/**
 * Helper module for TOR functions.
 */
module.exports = {
    /**
     * Send a new circuit signal to a running tor instance.
     */
    newCircuit: function(callback, account, logger) {
        logger = logger || winston;
        logger.info("Sending new circuit signal to TOR...");

        var net = require('net');

        var client = new net.Socket();
        client.connect(account.torconfig.controlport, account.torconfig.controladdr, function() {
            client.write('AUTHENTICATE \"' + account.torconfig.password + '\"\r\nSIGNAL NEWNYM\r\n');
        });

        client.on('data', function(data) {
            client.destroy();
            
            if(callback != null)
                callback();
        });

        client.on('close', function() { }); 
    }
}