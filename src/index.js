import express from "express";
import crypto from "crypto";
import config from "config";
import DDPClient from "ddp";
import FB from "fb";
import { URL } from "url";

import logger from "./logger";
import subscriptions from "./subscriptions";

const ENV = process.env.NODE_ENV;
const PORT = process.env.PORT || 8000;

const facebookConfig = config.get("facebook");
const siteUrl = new URL(process.env.SITE_URL || config.get("url"));
const app = express();

app.set("fbVerifyToken", crypto.randomBytes(12).toString("hex"));

// Liane DDP
const lianeConfig = config.get("liane");
const lianeClient = new DDPClient({
  host: lianeConfig.host,
  port: lianeConfig.port,
  autoReconnect: true,
  autoReconnectTimer: 500,
  ddpVersion: "1",
  useSockJs: true
});

app.set("lianeClient", lianeClient);

lianeClient.connect((err, wasReconnect) => {
  if (err) {
    logger.error("Error connecting to Liane");
    return;
  } else if (wasReconnect) {
    logger.warn("Restablished connection to Liane");
  } else {
    logger.info("Connected to Liane");
  }
});

// Facebook

FB.options({
  appId: facebookConfig.clientID,
  appSecret: facebookConfig.clientSecret
});

FB.api(
  "oauth/access_token",
  {
    client_id: facebookConfig.clientId,
    client_secret: facebookConfig.clientSecret,
    grant_type: "client_credentials"
  },
  res => {
    // FB.api(facebookConfig.clientId, "post", {
    //   link: siteUrl.origin,
    //   website_url: siteUrl.origin,
    //   app_domains: [siteUrl.hostname],
    //   access_token: res.access_token
    // });
    FB.api(`${facebookConfig.clientId}/subscriptions`, "post", {
      object: "page",
      callback_url: `${siteUrl.origin}/subscriptions`,
      fields: [
        "feed",
        "messages",
        "message_deliveries",
        "messaging_postbacks",
        "message_deliveries",
        "message_reads",
        "ratings",
        "mention"
      ],
      verify_token: app.get("fbVerifyToken"),
      access_token: res.access_token
    });
  }
);

app.use("/subscriptions", subscriptions);

app.listen(PORT, () => {
  logger.info(`Listening on port ${PORT}`);
});
