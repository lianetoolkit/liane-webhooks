const nodemon = require("nodemon");
const ngrok = require("ngrok");

(async () => {
  const url = await ngrok.connect(process.env.PORT || 8000);

  nodemon({
    script: "src/index.js",
    ignore: [".git", "node_modules/**/node_modules"],
    env: {
      SITE_URL: url
    },
    ext: "js json",
    execMap: {
      js: "babel-node"
    }
  });

  nodemon
    .on("start", function() {
      console.log("App has started at " + url);
    })
    .on("quit", function() {
      console.log("App has quit");
      process.exit();
    })
    .on("restart", function(files) {
      console.log("App restarted due to: ", files);
    });
})();
