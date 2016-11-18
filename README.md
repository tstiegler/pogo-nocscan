# pogo-nocscan

### Usage

1. Modify your configuration files.
2. Modify `pogo-nocscan/frontend/index.html` and add in a google maps javascript API key.
3. Run the following:

```
npm install
cd pogo-nocscan
node scanserver.js
```

4. Navigate to `http://127.0.0.1:3000`

### Configuration

When `pogo-nocscan` is loaded, all files in the root folder beginning with `config.` and ending in `.js` are treated as config files to be loaded. Configuration files are plain javscript files that expose a configuration object or array of configuration objects through `module.exports`. The example configuration file shows this in action.

A single configuration object can have one or more accounts that scan at a given location. These accounts are used one at a time. If you want to have simultaneous accounts, you should have multiple configurations (via multiple js files, or by exposing an array of configuration objects).

At its simplest, a configuration file can look like this:

```javascript
var config = {
    "name": "example",
    "huntIds": [],
    "accounts": [
        {
            "username": "exampleptcuser1",
            "password": "examplepass",
            "locator": {
                "plugin": "static",
                "config": { "lat": -34.009493, "lng": -118.496862 }
            },
            "hours": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
            "allowNoProxy": true 
        }
    ], 
    "notifiers": []
};

module.exports = config;
```

The above configuration places a worker at the Santa Monica Pier, does not send any notifications and does not create sub-workers to scan for anything nearby.

#### The "configuration" object.

The table below shows the different properties a "configuration" object (as shown in the example above) can have.

Property | Type | Description | Required?
--- | --- | --- | ---
`name` | string | Basic identifier for the config (used in logging) | yes
`catchableOnly` | bool | If true, only send notifications for pokemon in catchable range (no nearby notifications) | no (default: false)
`huntIds` | Array<Number> | List of pokemon id numbers used for hunting and notifications | yes (can be empty)
`accounts` | Array<Account> | List of accounts to scan with | yes
`notifiers` | Array<Notifier> | List of notification methods, for sending notifications | yes (can be empty)

#### The "account" object.

Each account can have different paramaters apart from just username and password. Account objects are specified below.

Property | Type | Description | Required?
--- | --- | --- | ---
`username` | string | PTC username | yes
`password` | string | PTC password | yes
`locator` | Locator | The locator plugin configuration, used for getting scan GPS locations | yes
`hours` | Array<Number> | A list of hours of the day this account can run during | yes (use 1...24 to run 24/7)
`proxy` | string \| ProxyResolver | If string, a http proxy url to use for connections. More info about ProxyResolvers later | no
`allowNoProxy` | bool | If set to true, this will allow accounts to operate without using a proxy | no (default: false)
`torconfig` | TorConfig | Configuration options for a TOR instance. Used to send new circuit signals if a circuit can't connect | no
`huntScanners` | Array<Account> | List of accounts to use as sub-scanners for hunting nearby pokemon as listed in `huntIds` | no

#### ProxyResolvers

Perhaps you don't want to use just a single proxy address per account. Maybe you want it randomly selected via a proxy address pool. This is accomplished via a proxy resolver.

A proxy resolver is merely an object with three methods: `next`, `get` and `reject`. The `next` method should pick the next proxy in the list and return it, the `get` method should return the previously picked proxy and the `reject` method should handle malfunctioning proxies.

I say _should_ because proxy resolvers are entirely customizable, you can create your own and inject them into your configurations. However, an example one comes included in `proxyresolver.array.js`. Below is an example for using it:

```javascript
// Proxy resolver for all accounts.
var proxyResolver = require('./proxyresolver.array.js')([
    "http://32.32.32.32:8080",
    "http://64.64.64.64:8080",
    "http://96.96.96.96:8080",
    "http://128.128.128.128:8080"
]);


// Default config.
var config = {
    "name": "example",
    "huntIds": [],
    "accounts": [
        {
            "username": "exampleptcuser1",
            "password": "examplepass",
            "locator": { 
                "plugin": "static", 
                "config": { "lat": -34.009493, "lng": -118.496862 } 
            },
            "hours": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
            "proxy": proxyResolver      
        },
    ], 
    "notifiers": []
};

module.exports = config;
```

The above code will use the array ProxyResolver, which selects a proxy from the given array by random. If a proxy is malfunctioning, it will exclude it from being able to be chosen.

### huntIds and Notifications

pogo-nocscan has the ability to send notifications when a pokemon is in either the nearby or catchable state. 

The nearby notification will fire when a Pokemon is within 200 meters of the scan point. This notification will contain a link which will show the nearby radius, as well as the s2 cell bounds. This alone can allow for some rudimentary tracking/

If the account is setup with the `huntScanners` property, the scanner will start some sub-workers that will navigate that s2 cell to search for the pokemon. Once it is found, it will send a notification with the exact coordinates of the Pokemon.

Currently, there are three different types of notification methods (notifier plugins). These being email, pushover.net and Slack.

If you are scanning an area with a large amount of accounts simultaneously (eg: a beehive scann), then some specific concerns need to be addressed. For example, you do not need to set `huntScanners` for any account, because hunter scanners are uneccesary. You will also need to set `catchableOnly` on each account's configuration object, so you don't get the "nearby" notificatsion, only the "catchable" notifications.

### UI Configuration

[TBD]

### Plugin Configuration

There are two different types of plugins, locators and notifers, each using the same configuration layout of:

```json
{
    "plugin": "<Plugin name string>",
    "config": <Specific-plugin-config-JSON>
}
```

#### Locators

##### webjson

The `webjson` locator plugin will fetch a JSON file from the web and use that for the location. The JSON file must be in the format of `{"lat": "-34.009493", "lng": "-118.496862"}`. This is useful in confjunction with something like [Self hosted GPS Tracker](https://play.google.com/store/apps/details?id=fr.herverenault.selfhostedgpstracker&hl=en) to get a constant location for your phone as you play Pokemon GO.

The configuration expected is as follows:

```json
{
    "url": "<URL to json file as string -- http://example.com/json>"
}
```

##### static

The `static` locator plugin will just use the same GPS location repeatedly. However, pogo-nocscan employs some very minor randomization to the GPS coordinates so as to not repeatedly send the same coordinates to the Niantic API.
The configuration expected is as follows:

```json
{
    "lat": -34.009493, 
    "lng": -118.496862
}
```

#### Notifiers

##### email
Probably one of the harder to setup, since you need your own mail server (look into Zoho if you want to use this option, but honestly, Slack or Pushover are much better).

The configuration expected is as follows:

```json
{
    "connectionString": "smtps://example%40example.com:password@smtp.zoho.com:465",
    "sendTo": "gimmespawnsnowplzthx@gmail.com",
    "sendFrom": "\"Your friendly neighbourhood Pokemon.\" <pokemon@example.com>"
}
```
##### pushover
This option uses the [pushover.net](http://pushover.net) service to send push notifications of spawns. Unfortunately pushover costs a one time fee of $4.99 per platform (iOS, android, etc) so you might want to opt for Slack.

The configuration expected is as follows:

```json
{
    "token": "<Pushover app token>",
    "user": "<Pushover user token>"
}
```

##### slack
My new favorite, Slack. This will send chat messages to a Slack room, you just need to get a webhook token from [here](https://my.slack.com/services/new/incoming-webhook/).

The configuration expected is as follows:

```json
{
    "webhookUrl": "https://hooks.slack.com/services/XXXXXX/YYYYYY/ZZZZZZZZZZZZ",
    "webhookConfig": {
        "username": "spawnbot",
        "icon_emoji": ":ghost:"
    },
    "sentTo": "everyone"
}
```

The `webhookConfig` parameter can contain any parameter specified in the [Slack Incoming Webhook API Spec](https://api.slack.com/incoming-webhooks).

### Included Sample configurations

[TBD]