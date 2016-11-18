/**
 * This is an example config that shows how to load accounts from a CSV file 
 * and run them in an automatically calculated beehive formation.
 * 
 * The CSV file should just have usernames, seperated by passwords. ie:
 * 
 * user1,pass1
 * user2,pass2
 * 
 * ---
 * 
 * You can also specify a file to load proxies from. These proxies will be 
 * setup using the default array proxyresolver, which will select a random
 * proxy whenever an account logs in.
 * 
 * Below is the configuration for the config, should be self explanatory.
 * 
 * ============================================================================
 */

// CSV/PROXY/BEEHIVE CONFIG

var accountsCSV = "accounts.csv";
var proxiesListFile = "proxies.txt"; // Just a list of proxies seperated by \n -- leave this field blank for no proxy. 
var beehiveCenter = {
    lat: 0,
    lng: 0
};
var beehiveDepth = 2; // 1 = 70m, 2 = 210m, 3 = 350m ...

// ----------------------------------------------------------------------------

var beehive = require("beehive-cluster");
var _       = require("lodash");
var fs      = require("fs");

var beehiveData = beehive.mkHive({lat: beehiveCenter.lat, lon: beehiveCenter.lng}, beehiveDepth, 70).toArray();

var config = [];

// Load up accounts CSV.
var accountsRows = fs.readFileSync(accountsCSV).toString().split('\n');
var accounts = [];
_.each(accountsRows, function(accountRow) {
    var arSplit = accountRow.split(',');
    accounts.push({
        username: arSplit[0].trim(),
        password: arSplit[1].trim()
    });
})

// Load up proxies for the proxy resolver.
var useProxies = (proxiesListFile != "");
var proxyResolver;

if(useProxies) {
    var proxyList = fs.readFileSync(proxiesListFile).toString().split('\n');
    proxyResolver = require("./proxyresolver.array.js")(proxyList);
}

// Check if we have enough accounts for the beehive data.
if(beehiveData.length > accounts.length)
    console.log("You do not have enough accounts to cover this beehive (you need " + beehiveData.length + " accounts).");

if(accounts.length > beehiveData.length)
    console.log("You have more accounts than locations in this beehive, not all accounts will be used.");

// Iterate over each account in the CSV and create a configuration for it.
_.each(accounts, function(account, idx) {
    // Check if there is enough beehive elements for this account.
    // If not, skip it.
    if(idx > (beehiveData.length - 1)) 
        return;

    // Create and add config.
    var accLocation = beehiveData[idx];
    var accConfig = {
        name: "beehive" + idx,
        huntIds: [],
        notifiers: [],
        accounts: [
            {
                "username": account.username,
                "password": account.password,
                "locator": {
                    "plugin": "static",
                    "config": {
                        "lat": accLocation[0],
                        "lng": accLocation[1]
                    }
                }
            }
        ]
    };

    if(!useProxies)
        accConfig.accounts[0].allowNoProxy = true;
    else
        accConfig.accounts[0].proxy = proxyResolver;

    config.push(accConfig);
})

module.exports = config;