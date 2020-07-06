const config = require("config");
const nodemon = require("nodemon");
const localtunnel = require("localtunnel");

const PORT = process.env.PORT || 8000;

const opts = config.get("localtunnel");

(async () => {
  let url;
  const tunnel = await new Promise((resolve, reject) =>
    localtunnel(
      PORT,
      Object.assign({}, opts || {}, { port: PORT }),
      (err, tunnel) => {
        if (err) {
          reject(err);
        } else {
          url = tunnel.url;
          console.log("Waiting 5 seconds...");
          setTimeout(() => {
            console.log("App starting on " + url);
            resolve(tunnel);
          }, 5000);
        }
      }
    )
  );

  nodemon({
    script: "src/index.js",
    ignore: [".git", "node_modules/**/node_modules"],
    env: {
      SITE_URL: url,
      PORT: PORT,
    },
    ext: "js json",
    execMap: {
      js: "babel-node",
    },
  });

  tunnel
    .on("error", function (err) {
      throw err;
    })
    .on("close", function () {
      console.log("Localtunnel closed");
      process.exit();
    })
    .on("request", function (info) {
      console.log(new Date().toString(), info.method, info.path);
    });
})();
