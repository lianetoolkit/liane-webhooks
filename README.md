# Liane Webhooks

## Facebook Webhooks Proxy

This small app serves as a proxy for Facebook Webhook, allowing you to configure multiple services to receive the data.

### Supported Methods

- Meteor DDP
- HTTP _(soon)_

### Configuring

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
    "clientSecret": "<client secret>"
  },
  "services": {
    "liane": {
      "type": "ddp",
      "methodName": "webhookUpdate",
      "entries": ["feed"],
      "host": "localhost",
      "port": 3000,
      "token": "token_here"
    },
    "another": {
      "type": "http",
      "entries": [
        "messages",
        "message_reads",
        "message_postbacks",
        "message_reads"
      ],
      "url": "http://localhost:4000/subscriptions",
      "token": "token_here",
      "test": true
    }
  }
}
```

#### URL

Your webhook url. Must be SSL for receiving Facebook webhook data. Can be blank if running in development mode with `npm run watch`.

#### Localtunnel

Optional for custom [localtunnel server](https://github.com/localtunnel/server).

#### Facebook (required)

Your Facebook app client settings.

#### Services (required)

Services that will receive the data.

- **type**: can be `ddp` or `http`
- **methodName**: name of the service's DDP method _(DDP only)_
- **entries**: list of [entry types](https://developers.facebook.com/docs/graph-api/webhooks/reference) that this service should receive
- **host**: hostname for DDP client connection _(DDP only)_
- **port**: port for DDP client connection _(DDP only)_
- **url**: full URL for HTTP connection _(HTTP only)_
- **token**: token provided by the service for security validation
- **test**: if set to true, errors coming from this service won't be sent as response to Facebook (keeps Facebook from reattempting to send the data)

### Usage

Install dependencies by running `npm install`.

You can run in development mode using `npm run watch`, which will automatically start a **localtunnel** with **nodemon**, configure your site url and set the webhook configuration to your Facebook app.

For production use, make sure you have all the config settings set and run `npm start`.
