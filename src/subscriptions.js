import express from "express";
import config from "config";
import bodyParser from "body-parser";
import crypto from "crypto";
import axios from "axios";

import logger from "./logger";

const app = express();
app.use(
  bodyParser.json({
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || "utf8");
      }
    },
  })
);
app.use(bodyParser.urlencoded({ extended: true }));

const MESSAGE_FIELD_MAP = {
  messages: "message",
  message_deliveries: "delivery",
  messaging_optins: "optin",
  messaging_postbacks: "postback",
  message_reads: "read",
};

// Log request
const logRequest = (req, res, next) => {
  let body = JSON.stringify(req.body);
  const facebookConfig = config.get("facebook");
  if (facebookConfig.logWebhookBodies) {
    logger.info(`webhook body: ${body}`);
  }
  next();
};

// Validate request
// Should either be authorization or webhook data with signature
const validateRequest = (req, res, next) => {
  if (req.query["hub.mode"] == "subscribe" || req.headers["x-hub-signature"]) {
    next();
  } else {
    logger.warn("Invalid request, returning 200 anyway");
    res.status(200).send("pong");
  }
};

// Authorize Facebook
const authorizeFacebook = (req, res, next) => {
  try {
    if (req.query["hub.mode"] == "subscribe") {
      const valid = req.query["hub.verify_token"] == app.get("fbVerifyToken");
      if (valid) {
        logger.info("Authorizing subscription through hub token");
        res.status(200).send(req.query["hub.challenge"]);
      } else {
        logger.warn("Unauthorized authorization request");
        res.sendStatus(200);
      }
    } else {
      next();
    }
  } catch (err) {
    res.sendStatus(200);
  }
};

// Hub signature verification
const verifyHubSignature = (req, res, next) => {
  try {
    const facebookConfig = config.get("facebook");
    const signature = req.headers["x-hub-signature"];
    if (signature !== undefined) {
      const hmac = crypto.createHmac("sha1", facebookConfig.clientSecret);
      hmac.update(req.rawBody);
      const expectedSignature = "sha1=" + hmac.digest("hex");
      if (expectedSignature !== signature) {
        logger.warn("Invalid signature from hub challenge");
        res.sendStatus(200);
      } else {
        next();
      }
    } else {
      next();
    }
  } catch (err) {
    res.sendStatus(200);
  }
};

const validateDDPClient = (client) => {
  return !(
    client._isConnecting ||
    client._isReconnecting ||
    client._connectionFailed ||
    client._isClosing
  );
};

const Push = function (name, service, facebookId, item, time, object = "page") {
  return {
    ddp: () => {
      const clients = app.get("ddpClients");
      const client = clients[name];
      return new Promise((resolve, reject) => {
        if (!validateDDPClient(client)) {
          if (service.test) {
            logger.warn(`${name} client not connected`);
            resolve();
          } else {
            reject(`${name} client not connected`);
          }
        } else {
          client.call(
            service.methodName,
            [
              {
                token: service.token,
                facebookAccountId: facebookId,
                data: getBody(facebookId, time, item, object),
              },
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
        }
      });
    },
    http: () => {
      return new Promise((resolve, reject) => {
        let url = service.url;
        if (service.token) {
          url += `?token=${service.token}`;
        }
        const body = getBody(facebookId, time, item, object);
        axios
          .post(url, body)
          .then((res) => {
            resolve(res);
          })
          .catch((err) => {
            if (service.test) {
              logger.warn(`${name} test service errored`);
              console.log(err);
              resolve();
            } else {
              reject(err);
            }
          });
      });
    },
  };
};

const validateFields = (serviceFields, item) => {
  if (item.field) {
    // FEED validation
    return serviceFields.indexOf(item.field) !== -1;
  } else if (item.sender) {
    // Message validation
    let fields = serviceFields.map((field) => MESSAGE_FIELD_MAP[field]);
    let valid = false;
    Object.keys(item).forEach((key) => {
      if (fields.indexOf(key) !== -1) valid = true;
    });
    return valid;
  }
  return false;
};

const getBody = (facebookId, time, item, object = "page") => {
  let body = {
    object: object,
    entry: [
      {
        time,
        id: facebookId,
      },
    ],
  };
  if (item.field) {
    body.entry[0].changes = [item];
  }
  if (item.sender) {
    body.entry[0].messaging = [item];
  }
  return body;
};

const pushItem = (facebookId, item, time, object = "page") => {
  const services = config.get("services");
  let promises = [];
  for (const serviceName in services) {
    const service = services[serviceName];
    if (
      !service.fields ||
      !service.fields.length ||
      validateFields(service.fields, item)
    ) {
      promises.push(
        new Promise((resolve, reject) => {
          const push = Push(
            serviceName,
            service,
            facebookId,
            item,
            time,
            object
          );
          if (push[service.type]) {
            push[service.type]()
              .then((res) => {
                resolve(res);
              })
              .catch((err) => {
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
  logRequest,
  validateRequest,
  authorizeFacebook,
  verifyHubSignature,
  (req, res) => {
    let body = req.body;
    logger.info(`body.object: ${body.object}`);
    if (Buffer.isBuffer(req.body)) body = JSON.parse(req.body.toString());
    try {
      if (body.object == "page" || body.object == "instagram") {
        logger.info(
          `Receiving ${body.entry.length} entries from Facebook subscription`
        );
        let errors = [];
        let promises = [];
        body.entry.forEach((entry) => {
          const facebookId = entry.id;
          if (entry.changes) {
            entry.changes.forEach(async (item) => {
              promises.push(pushItem(facebookId, item, entry.time, body.object));
            });
          } else if (entry.messaging) {
            entry.messaging.forEach(async (item) => {
              promises.push(pushItem(facebookId, item, entry.time));
            });
          }
        });
        Promise.all(promises)
          .then(() => {
            logger.info("Succesfully processed webhook updates");
            res.sendStatus(200);
          })
          .catch((err) => {
            console.log(err);
            logger.error("Error processing webhook data");
            res.sendStatus(200);
          });
      } else {
        logger.warn("Bad request");
        res.sendStatus(200);
      }
    } catch (err) {
      res.sendStatus(200);
    }
  }
);

export default app;
