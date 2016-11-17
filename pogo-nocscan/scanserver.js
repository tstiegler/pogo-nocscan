/**
 * Scanner server, capable of running multiple scanner configurations with
 * a web API and frontend UI.
 */

var express     = require('express');
var _           = require('lodash');
var winston     = require('winston');

var c           = require("./constants.js");
var scanner     = require("./scanner.js");

// Configuration
// ============================================================================

var scanners = [
    scanner(require('./config.example.js'))
];

var uiconfig = {
    mode: c.UI_MODE_SHOW_ACCOUNTS,
    initialCenter: {
        lat: 42.682052, 
        lng: -83.133825
    }
};

// ----------------------------------------------------------------------------

// Create app.
var app = express();
winston.level = 'error';

// Serve up the static frontend files.
app.use('/frontend', express.static('frontend'));


/**
 * Redirect root calls to the static fronend folder. 
 */
app.get('/', function(req, res) {
    res.redirect("/frontend");
})


/**
 * Fetch UI configuration.
 */
app.get("/uiconfig", function(req, res) {
    res.send(uiconfig);
})


/**
 * Fetch list of scanners.
 */
app.get('/scanners', function (req, res) {    
    var result = [];

    // Don't allow users to see accounts in encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }

    _.each(scanners, function(item) {
        if(item.getActiveAccount() != null)
            result.push(item.getActiveAccount().username);        
    });

    res.send(result);
});


/**
 * Fetch scanner active account info.
 */
app.get('/scanner/:username', function(req, res) {  
    // Don't allow users to see accounts in encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }

    var scanner = getByUsername(req.params.username);

    if(scanner != null && scanner.getActiveScanner() != null)
        res.send(scanner.getActiveScanner());
    else
        res.send([]);
});


/**
 * Fetch latest mapobjects for account. 
 */
app.get('/mapobjects/:username', function(req, res) {
    // Don't allow users to see accounts in encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }
        
    var scanner = getByUsername(req.params.username);

    if(scanner != null && scanner.getActiveScanner() != null)
        res.send(scanner.getActiveScanner().getLastMapObjects());
    else
        res.send([]);
});


/**
 * Fetch latest encounters for account. 
 */
app.get('/encounters/:username', function(req, res) { 
    // Don't allow users to see accounts in encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }
      
    var scanner = getByUsername(req.params.username);

    if(scanner != null && scanner.getActiveScanner() != null)
        res.send(scanner.getActiveScanner().getKnownEncounters());
    else
        res.send([]);
});


/**
 * Fetch latest GPS position for account.
 */
app.get('/position/:username', function(req, res) {
    // Don't allow users to see accounts in encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }
    
    var scanner = getByUsername(req.params.username);

    if(scanner != null)
        res.send(scanner.getActiveScanner().getPosition());
    else
        res.send([]);
});


/**
 * Fetch latest GPS position for account.
 */
app.get('/allencounters', function(req, res) {
    var result = {};

    _.each(scanners, function(item) {
        if(item.getActiveScanner() == null)
            return;

        _.forOwn(item.getActiveScanner().getKnownEncounters(), function(encounter, id) {
            result[id] = encounter;
        });
    });

    res.send(result);
});


/**
 * Setup the server.
 */
app.listen(3000, function () {
    winston.info('Scan Web API app listening on port 3000!')
})


/**
 * Get scanner by currently activeuser name
 */
function getByUsername(username) {
    var scanner = _.filter(scanners, function(item) {
        if(item.getActiveAccount() == null)
            return false;

        return item.getActiveAccount().username == username;
    });

    if(scanner.length == 0 || scanner[0].getActiveScanner() == null) 
        return null;

    scanner = scanner[0];
    return scanner;
}