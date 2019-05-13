import express from "express";
import config from "config";
import bodyParser from "body-parser";
import crypto from "crypto";

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
  const lianeClient = app.get("liane");
  let body = req.body;
  if (Buffer.isBuffer(req.body)) body = JSON.parse(req.body.toString());
  if (
    req.query["hub.mode"] == "subscribe" &&
    req.query["hub.verify_token"] == app.get("fbVerifyToken")
  ) {
    // Authorize subscription
    res.status(200).send(req.query["hub.challenge"]);
  } else if (body.object == "page") {
    // Subscription update
    body.entry.forEach(entry => {
      const facebookId = entry.id;
      entry.changes.forEach(item => {
        console.log({ item });
        switch (item.field) {
          case "feed":
            const value = item.value;
            console.log({ value });
            lianeClient.call(
              "webhookUpdate",
              [
                {
                  token: "test",
                  facebookAccountId: facebookId,
                  data: value
                }
              ],
              (err, res) => {
                console.log(res);
              }
            );
          // switch (value.verb) {
          //   case "add":
          //     if (value.item == "comment") {
          //       console.log("Comment added");
          //     } else {
          //       console.log("new entry", value);
          //     }
          //     break;
          //   case "remove":
          //     break;
          // }
          // break;
        }
      });
      res.status(200).send("ok");
    });
  } else {
    res.sendStatus(400);
  }
});

export default app;
