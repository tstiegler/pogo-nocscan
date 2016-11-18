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

### Configuration

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
