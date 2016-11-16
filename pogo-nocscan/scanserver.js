/**
 * Scanner server, capable of running multiple scanner configurations with
 * a web API and frontend UI.
 */

var express     = require('express');
var _           = require('lodash');
var winston     = require('winston');

var scanner     = require("./scanner.js")

var scanners = [
    scanner(require('./config.example.js'))
];

// Create app.
var app = express();
winston.level = 'debug';

// Serve up the static frontend files.
app.use('/frontend', express.static('frontend'));


/**
 * Redirect root calls to the static fronend folder. 
 */
app.get('/', function(req, res) {
    res.redirect("/frontend");
})


/**
 * Fetch list of scanners.
 */
app.get('/scanners', function (req, res) {    
    var result = [];

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
    var scanner = _.filter(scanners, function(item) {
        if(item.getActiveAccount() == null)
            return false;
            
        return item.getActiveAccount().username == req.params.username;
    });

    if(scanner.length == 0 || scanner[0].getActiveScanner() == null) {
        res.send([]);
        return;
    }

    scanner = scanner[0];

    res.send(scanner.getActiveScanner());
});


/**
 * Fetch latest mapobjects for account. 
 */
app.get('/mapobjects/:username', function(req, res) {    

    var scanner = _.filter(scanners, function(item) {
        if(item.getActiveAccount() == null)
            return false;

        return item.getActiveAccount().username == req.params.username;
    });

    if(scanner.length == 0 || scanner[0].getActiveScanner() == null) {
        res.send([]);
        return;
    }

    scanner = scanner[0];

    res.send(scanner.getActiveScanner().getLastMapObjects());
});


/**
 * Fetch latest GPS position for account.
 */
app.get('/position/:username', function(req, res) {
    var scanner = _.filter(scanners, function(item) {
        if(item.getActiveAccount() == null)
            return false;

        return item.getActiveAccount().username == req.params.username;
    });

    if(scanner.length == 0 || scanner[0].getActiveScanner() == null) {
        res.send([]);
        return;
    }

    scanner = scanner[0].getActiveScanner();
    res.send(scanner.getPosition());
});


/**
 * Setup the server.
 */
app.listen(3000, function () {
    winston.info('Scan Web API app listening on port 3000!')
})