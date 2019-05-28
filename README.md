# Liane Webhooks

**A small app for proxying Facebook Webhooks**

---

This small app serves as a proxy for Facebook Webhooks, allowing you to configure multiple services to receive the data.

Currently supports only [_Page_ webhooks](https://developers.facebook.com/docs/graph-api/webhooks/reference/page/), which also includes the [Messenger Platform](https://developers.facebook.com/docs/messenger-platform/webhook/).

## Supported Methods

- Meteor DDP
- HTTP _(soon)_

## Configuring

At `config/` directory you can create `production.json` and `development.json` configuration files to setup your variables.

Example config file:

```json
{
  "url": "<site url>",
  "localtunnel": {
    "host": "<your localtunnel server (optional)>",
    "subdomain": "<your subdomain (optional)>"
  },
  "facebook": {
    "clientId": "<client id>",
    "clientSecret": "<client secret>",
    "fields": ["<array of webhook fields to subscribe to>"]
  },
  "services": {
    "liane": {
      "type": "ddp",
      "methodName": "webhookUpdate",
      "fields": ["feed"],
      "host": "localhost",
      "port": 3000,
      "token": "token_here"
    },
    "another": {
      "type": "http",
      "fields": [
        "messages",
        "message_deliveries",
        "message_reads",
        "message_deliveries",
        "messaging_postbacks",
        "messaging_optins"
      ],
      "url": "http://localhost:4000/subscriptions",
      "token": "token_here",
      "test": true
    }
  }
}
```

### URL

Your webhook url. Must be SSL for receiving Facebook webhook data. Can be blank if running in development mode with `npm run watch`.

### Localtunnel

Optional for custom [localtunnel server](https://github.com/localtunnel/server).

### Facebook (required)

- **clientId**: you Facebook App client ID
- **clientSecret**: you Facebook App client secret
- **fields**: list of fields to subscribe to

### Services (required)

Services that will receive the data.

- **type**: can be `ddp` or `http`
- **methodName**: name of the service's DDP method _(DDP only)_
- **fields**: list of [fields](https://developers.facebook.com/docs/graph-api/webhooks/reference/page/) that this service should receive data from
- **host**: hostname for DDP client connection _(DDP only)_
- **port**: port for DDP client connection _(DDP only)_
- **url**: full URL for HTTP connection _(HTTP only)_
- **token**: token provided by the service for security validation
- **test**: if set to true, errors coming from this service won't be sent as response to Facebook (keeps Facebook from reattempting to send the data)

## Usage

**WARNING: By running the app, it will automatically set your app webhook URL with a generated verification token.**

Install dependencies by running `npm install`.

You can run in development mode using `npm run watch`, which will automatically start a **localtunnel** with **nodemon**, configure your site url and set the webhook configuration to your Facebook app.

### Production

For production use, make sure you have all the config settings set.

Build by running `npm run build` then serve with `npm run serve`.
