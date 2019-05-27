import express from "express";
import config from "config";
import bodyParser from "body-parser";
import crypto from "crypto";

import logger from "./logger";

const app = express();
app.use(
  bodyParser.json({
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || "utf8");
      }
    }
  })
);
app.use(bodyParser.urlencoded({ extended: true }));

// Validate request
// Should either be authorization or webhook data with signature
const validateRequest = (req, res, next) => {
  if (req.query["hub.mode"] == "subscribe" || req.headers["x-hub-signature"]) {
    next();
  } else {
    logger.warn("Invalid request");
    res.status(400).send("Invalid request");
  }
};

// Authorize Facebook
const authorizeFacebook = (req, res, next) => {
  if (req.query["hub.mode"] == "subscribe") {
    const valid = req.query["hub.verify_token"] == app.get("fbVerifyToken");
    if (valid) {
      logger.info("Authorizing subscription through hub token");
      res.status(200).send(req.query["hub.challenge"]);
    } else {
      logger.warn("Unauthorized authorization request");
      res.status(400).send("Invalid token");
    }
  } else {
    next();
  }
};

// Hub signature verification
const verifyHubSignature = (req, res, next) => {
  const facebookConfig = config.get("facebook");
  const signature = req.headers["x-hub-signature"];
  if (signature !== undefined) {
    const hmac = crypto.createHmac("sha1", facebookConfig.clientSecret);
    hmac.update(req.rawBody);
    const expectedSignature = "sha1=" + hmac.digest("hex");
    if (expectedSignature !== signature) {
      logger.warn("Invalid signature from hub challenge");
      res.status(400).send("Invalid signature");
    } else {
      next();
    }
  } else {
    next();
  }
};

// Handling subscription data
app.use(
  "/",
  validateRequest,
  authorizeFacebook,
  verifyHubSignature,
  (req, res) => {
    const lianeConfig = config.get("liane");
    const lianeClient = app.get("lianeClient");
    let body = req.body;
    if (Buffer.isBuffer(req.body)) body = JSON.parse(req.body.toString());
    if (body.object == "page") {
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
  }
);

export default app;
