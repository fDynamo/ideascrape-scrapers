function registerGracefulExit(onExit, stopAfter = false) {
  if (process.platform === "win32") {
    let rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("SIGINT", function () {
      process.emit("SIGINT");
    });
  }

  process.on("SIGINT", function () {
    onExit();
    if (stopAfter) {
      process.exit();
    }
  });
}

module.exports = registerGracefulExit;
