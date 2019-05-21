import express from "express";
import config from "config";
import bodyParser from "body-parser";
import crypto from "crypto";

import logger from "./logger";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Hub signature verification middleware
const verifyHubSignature = (req, res, next) => {
  const facebookConfig = config.get("facebook");
  const signature = req.headers["x-hub-signature"];
  if (signature !== undefined && Buffer.isBuffer(req.body)) {
    const hmac = crypto.createHmac("sha1", facebookConfig.clientSecret);
    hmac.update(req.body);
    const expectedSignature = "sha1=" + hmac.digest("hex");
    if (expectedSignature !== signature) {
      logger.error("Invalid signature from hub challenge");
      res.status(400).send("Invalid signature");
    } else {
      next();
    }
  } else {
    next();
  }
};

// Handling subscription data
app.use("/", verifyHubSignature, (req, res) => {
  const lianeConfig = config.get("liane");
  const lianeClient = app.get("lianeClient");
  let body = req.body;
  if (Buffer.isBuffer(req.body)) body = JSON.parse(req.body.toString());
  if (
    req.query["hub.mode"] == "subscribe" &&
    req.query["hub.verify_token"] == app.get("fbVerifyToken")
  ) {
    // Authorize subscription
    logger.info("Authorizing subscription through hub signature challenge");
    res.status(200).send(req.query["hub.challenge"]);
  } else if (body.object == "page") {
    // Subscription update
    logger.info(
      `Receiving ${body.entry.length} entries from Facebook subscription`
    );
    let errors = [];
    body.entry.forEach(async entry => {
      const facebookId = entry.id;
      entry.changes.forEach(async item => {
        switch (item.field) {
          case "feed":
            const value = item.value;
            let response;
            try {
              response = await new Promise((resolve, reject) => {
                const callres = lianeClient.call(
                  "webhookUpdate",
                  [
                    {
                      token: lianeConfig.token,
                      facebookAccountId: facebookId,
                      data: value
                    }
                  ],
                  (err, res) => {
                    if (!err) {
                      resolve(res);
                    } else {
                      reject(err);
                    }
                  }
                );
              });
            } catch (err) {
              errors.push(err);
            }
            if (!response || response == undefined) {
              errors.push(
                "Unexpected error while sending webhook data to Liane"
              );
            }
            break;
          case "messages":
          case "message_deliveries":
          case "messaging_postbacks":
          case "message_deliveries":
          case "message_reads":
            // Send to yeeko
            break;
          default:
        }
      });
    });
    if (errors.length) {
      for (const error of errors) {
        logger.error("Error processing webhook data", error);
      }
      res.status(500).send(errors);
    } else {
      logger.info("Succesfully processed webhook updates");
      res.sendStatus(200);
    }
  } else {
    res.sendStatus(400);
  }
});

export default app;
