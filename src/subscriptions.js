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

const Push = function(name, service, facebookId, item) {
  return {
    ddp: () => {
      const clients = app.get("ddpClients");
      const client = clients[name];
      return new Promise((resolve, reject) => {
        client.call(
          service.methodName,
          [
            {
              token: service.token,
              facebookAccountId: facebookId,
              data: item.value
            }
          ],
          (err, res) => {
            if (!err) {
              resolve(res);
            } else {
              if (service.test) {
                logger.warn(`${name} test service errored`);
                console.log(err);
                resolve();
              } else {
                reject(err);
              }
            }
          }
        );
      });
    },
    http: () => {
      return new Promise(resolve => resolve());
    }
  };
};

const pushItem = (facebookId, item) => {
  const services = config.get("services");
  let promises = [];
  for (const serviceName in services) {
    const service = services[serviceName];
    if (service.entries.indexOf(item.field) !== -1) {
      promises.push(
        new Promise((resolve, reject) => {
          const push = Push(serviceName, service, facebookId, item);
          if (push[service.type]) {
            push[service.type]()
              .then(res => {
                resolve(res);
              })
              .catch(err => {
                reject(err);
              });
          } else {
            reject("Service type not supported");
          }
        })
      );
    }
  }
  return Promise.all(promises);
};

// Handling subscription data
app.use(
  "/",
  validateRequest,
  authorizeFacebook,
  verifyHubSignature,
  (req, res) => {
    let body = req.body;
    if (Buffer.isBuffer(req.body)) body = JSON.parse(req.body.toString());
    if (body.object == "page") {
      logger.info(
        `Receiving ${body.entry.length} entries from Facebook subscription`
      );
      let errors = [];
      let promises = [];
      body.entry.forEach(entry => {
        const facebookId = entry.id;
        entry.changes.forEach(async item => {
          promises.push(pushItem(facebookId, item));
        });
      });
      Promise.all(promises)
        .then(() => {
          logger.info("Succesfully processed webhook updates");
          res.sendStatus(200);
        })
        .catch(err => {
          logger.error("Error processing webhook data");
          res.status(500).send(errors);
        });
    } else {
      res.sendStatus(400);
    }
  }
);

export default app;
