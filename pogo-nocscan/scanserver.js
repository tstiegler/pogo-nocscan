/**
 * Scanner server, capable of running multiple scanner configurations with
 * a web API and frontend UI.
 */

var express         = require('express');
var bodyParser      = require('body-parser')
var _               = require('lodash');
var winston         = require('winston');
var ws              = require("nodejs-websocket");

var c               = require("./constants.js");
var scannerFactory  = require("./scanner.js");
var captchaHelper   = require("./helper.captcha.js");
var notiHelper      = require("./helper.notifications.js");

// Configuration
// ============================================================================

var configs = require("./configloader.js")();

var uiconfig = {
    mode: c.UI_MODE_SHOW_ACCOUNTS,
    initialCenter: {
        lat: 42.682052, 
        lng: -83.133825
    }
};

// ----------------------------------------------------------------------------

// Convert all configurations to scanners.
var scanners = [];
_.each(configs, function(item) { scanners.push(scannerFactory(item)); })

// Create app.
var app = express();
winston.level = 'info';


// Handle post data and serve up the static frontend files.
app.use(bodyParser.urlencoded({extended: true})); 
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

    if(scanner != null && scanner.getActiveScanner() != null) {
        var position = scanner.getActiveScanner().getPosition();

        var scanStrat = scanner.getActiveScanner().getStrategy();
        if("getHuntWorkers" in scanStrat) {
            var huntWorkers = scanStrat.getHuntWorkers();
            position.huntWorkers = [];
            _.each(huntWorkers, function(worker) {
                position.huntWorkers.push(worker.getPosition());
            });
        }

        res.send(position);
    } else
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
 * Fetch required captchas.
 */
app.get("/captchas", function(req, res) {
    // Don't allow users to see catpchas encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }

    res.send(captchaHelper.getCaptchaList());
});


/**
 * Handle captcha results.
 */
app.post('/captcharesult', function(req, res) {
    // Don't allow users to see catpchas encounters-only mode.
    if(uiconfig.mode != c.UI_MODE_SHOW_ACCOUNTS) {
        res.send([]);
        return;
    }

    var username    = req.body.username,
        token       = req.body.token;

    captchaHelper.setToken(username, token);
    winston.info("Received token for:" + username + " -- ", token);
    
    res.send("OK");
});


/**
 * Setup the server.
 */
app.listen(3000, function () {
    winston.info('Scan Web API app listening on port 3000!')
})


/**
 * Setup websockets server.
 */
var server = ws.createServer(function (conn) {
        winston.info("Incoming websockets connection");
        notiHelper.addWSConection(conn);

        /**
         * Handle incoming messages.
         */
        conn.on("text", function (str) { });

        /**
         * Handle connection closes.
         */
        conn.on("close", function (code, reason) {
            winston.info("Websockets connection close.");
            notiHelper.removeWSConnection(conn);
        })


        /**
         * Handle errors.
         */
        conn.on('error', function (err) {
            winston.info("Websockets connection error.");
            notiHelper.removeWSConnection(conn);
        })
    }).listen(3001);

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