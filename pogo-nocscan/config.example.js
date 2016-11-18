// Static position at Santa Monica Pier.
var defaultLocator = {
    "plugin": "static",
    "config": {
        "lat": 34.009351, 
		"lng": -118.496894
    }
};

// Proxy resolver for all accounts.
var proxyResolver = require('./proxyresolver.array.js')([
    "http://32.32.32.32:8080",
    "http://64.64.64.64:8080",
    "http://96.96.96.96:8080",
    "http://128.128.128.128:8080"
]);

// Default config, notifying on slack for a few rares.
var config = {
    "name": "example",
    "huntIds": [
        1, 2, 3, 4, 5, 6, 56, 57, 63, 64, 65, 
        66, 67, 68, 74, 75, 76, 83, 84, 85, 88, 89, 106, 
        107, 113, 114, 115, 122, 131, 132, 137, 138, 139,
        142, 143, 144, 145, 146, 147, 148, 149, 150, 151
    ],
    "accounts": [
        {
            "username": "exampleptcuser1",
            "password": "examplepass",
            "locator": defaultLocator,
            "hours": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
            "proxy": proxyResolver,
            "huntScanners": [{
                "username": "examplesub1",
                "password": "examplepass",
                "proxy": proxyResolver
            }]
        },
        {
            "username": "exampleptcuser2",
            "password": "examplepass",
            "locator": defaultLocator,
            "hours": [7, 8, 9, 10, 11, 12, 13, 14, 15],
            "proxy": proxyResolver,
            "huntScanners": [{
                "username": "examplesub2",
                "password": "examplepass",
                "proxy": proxyResolver
            }]     
        }
    ], 
    "notifiers": [
        {
            "plugin": "slack",
            "config": {
                "webhookUrl": "https://hooks.slack.com/services/XXXXXX/YYYYYY/ZZZZZZZZZZZZ",
                "webhookConfig": {
                    "username": "spawnbot",
                    "icon_emoji": ":ghost:"
                },
                "sentTo": "everyone"
            }
        }
    ]
};

module.exports = config;