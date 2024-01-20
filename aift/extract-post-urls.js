const fs = require("node:fs");
const path = require("node:path");
const { readCsvFile } = require("../helpers/read-csv");
const { getDateFilename, getArgs } = require("../helpers/index");

const VALID_EXTRACT_TYPES = ["all", "latest"];
let extractType = VALID_EXTRACT_TYPES[0];

// Handle CLI arguments
const cliArgs = getArgs();
const arg1 = cliArgs[0];

if (arg1) {
  if (VALID_EXTRACT_TYPES.includes(arg1)) {
    extractType = arg1;
  }
}

const main = async () => {
  const OUT_FOLDER = path.join(__dirname, "out");
  const PERIODS_FOLDER = path.join(OUT_FOLDER, "periods");
  const POST_URLS_FOLDER = path.join(OUT_FOLDER, "post_urls");

  const files = fs.readdirSync(PERIODS_FOLDER);

  let urlsList = [];
  const filesRead = [];

  if (extractType == VALID_EXTRACT_TYPES[0]) {
    // Get all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (path.extname(file) != ".csv") continue;
      filesRead.push(file);
    }
  }

  if (extractType == VALID_EXTRACT_TYPES[1]) {
    // Find oldest file
    let oldestFilename = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (path.extname(file) != ".csv") continue;

      if (!oldestFilename) oldestFilename = file;
      else {
        if (file > oldestFilename) oldestFilename = file;
      }
    }
    filesRead.push(oldestFilename);
  }

  for (let i = 0; i < filesRead.length; i++) {
    const file = filesRead[i];
    const filepath = path.join(PERIODS_FOLDER, file);
    const fileRows = await readCsvFile(filepath);
    fileRows.forEach((row) => {
      const url = row.postUrl;
      urlsList.push(url);
    });
  }

  urlsList = [...new Set(urlsList)];

  const runDate = new Date();
  const filename = getDateFilename(runDate) + ".json";
  const OUT_FILE = path.join(POST_URLS_FOLDER, filename);
  const toWrite = {
    countUrls: urlsList.length,
    filesRead,
    urls: urlsList,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(toWrite));
};
main();
