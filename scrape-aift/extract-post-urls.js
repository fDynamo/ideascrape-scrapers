const fs = require("node:fs");
const path = require("node:path");
const { readCsvFile } = require("../helpers/read-csv");
const { getArgs } = require("../helpers/index");
const { getOutFolder } = require("../helpers/get-paths");

const main = async () => {
  const VALID_EXTRACT_TYPES = ["all", "latest"];
  let extractType = VALID_EXTRACT_TYPES[1];

  // Handle CLI arguments
  const cliArgs = getArgs();
  const arg1 = cliArgs[0];

  if (arg1) {
    if (VALID_EXTRACT_TYPES.includes(arg1)) {
      extractType = arg1;
    }
  }

  // Folder variables
  const LISTS_FOLDER = getOutFolder("scrape_aift_lists");
  const POST_URLS_FOLDER = getOutFolder("scrape_aift_post_urls");
  const OUT_FILE = path.join(POST_URLS_FOLDER, extractType + ".json");

  // Get urls list
  const files = fs.readdirSync(LISTS_FOLDER);
  let urlsList = [];
  const filesRead = [];

  // All
  if (extractType == VALID_EXTRACT_TYPES[0]) {
    // Get all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.endsWith("-data.csv")) continue;
      filesRead.push(file);
    }
  }

  // Latest
  if (extractType == VALID_EXTRACT_TYPES[1]) {
    // Find oldest file
    let oldestFilename = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.endsWith("-data.csv")) continue;

      if (!oldestFilename) oldestFilename = file;
      else {
        if (file > oldestFilename) oldestFilename = file;
      }
    }
    filesRead.push(oldestFilename);
  }

  for (let i = 0; i < filesRead.length; i++) {
    const file = filesRead[i];
    const filepath = path.join(LISTS_FOLDER, file);
    const fileRows = await readCsvFile(filepath);
    fileRows.forEach((row) => {
      const url = row.source_url;
      urlsList.push(url);
    });
  }

  urlsList = [...new Set(urlsList)];

  const toWrite = {
    count: urlsList.length,
    files: filesRead,
    urls: urlsList,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(toWrite), { encoding: "utf-8" });
};
main();
