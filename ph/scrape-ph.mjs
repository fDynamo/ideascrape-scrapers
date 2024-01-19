import fs from "fs";
import { getArgs, getDateFilename, timeoutPromise } from "../helpers/index.js";
import { queryPH } from "./graphql-query.js";
import { createObjectCsvWriter } from "csv-writer";
import { flatten } from "flat";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_FOLDER = join(__dirname, "out");
const RUN_DELAY = 1500;

let START_CURSOR = 0;
let ENDING_CURSOR = 5;

// Handle CLI arguments
const cliArgs = getArgs();
const arg1 = cliArgs[0];
const arg2 = cliArgs[1];

if (arg1) {
  // If both arguments present, start and end
  if (arg2) {
    START_CURSOR = parseInt(arg1);
    ENDING_CURSOR = parseInt(arg2);
  }
  // Otherwise, only end
  else {
    ENDING_CURSOR = parseInt(arg1);
  }
}

const main = async () => {
  console.log("PH Scraper started");
  let cursor = START_CURSOR;
  let continueRunning = true;

  // Write log start
  const scriptStartedDate = new Date();
  const scriptStartedStr = scriptStartedDate.toISOString();
  const scriptStartedFilename = getDateFilename(scriptStartedDate);

  const logStartFileName = scriptStartedFilename + "-start.txt";
  const logStartFilePath = join(OUT_FOLDER, logStartFileName);
  const logFileStartContents = {
    startedAt: scriptStartedStr,
    args: cliArgs,
  };
  fs.writeFileSync(logStartFilePath, JSON.stringify(logFileStartContents));

  const logFileEndContents = {};

  // Start csv writer
  const outFileName = scriptStartedFilename + ".csv";
  const outFilePath = join(OUT_FOLDER, outFileName);
  let csvWriter = null;

  while (continueRunning) {
    console.log("Start cursor", cursor);

    try {
      const requestStartedDate = new Date();
      const requestStartedStr = requestStartedDate.toISOString();

      const queryRes = await queryPH(cursor);

      const requestEndedDate = new Date();
      const requestEndedStr = requestEndedDate.toISOString();

      const { pageInfo, edges } = queryRes.data.homefeed;
      const { date: nodeDate, items } = edges[0].node;

      console.log("Retrieved cursor", cursor);

      if (!items.length) {
        throw new Error("No items retrieved!");
      }

      const recordsToWrite = items.map((obj, objIndex) => {
        obj._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
          nodeDate,
          reqCursor: cursor,
          objIndex,
        };
        return flatten(obj);
      });

      if (!csvWriter) {
        const header = Object.keys(recordsToWrite[0]).map((headerTitle) => {
          return { id: headerTitle, title: headerTitle };
        });
        csvWriter = createObjectCsvWriter({
          path: outFilePath,
          header,
        });
      }
      csvWriter.writeRecords(recordsToWrite);

      if (!pageInfo.hasNextPage) {
        throw new Error("No next page");
      }
    } catch (error) {
      console.log("ERROR", error);
      logFileEndContents.message = "ERROR";
      logFileEndContents.error = "" + error;
      continueRunning = false;
      break;
    }

    // Increment cursor
    cursor++;

    // Log percentages
    const doneFraction =
      (cursor - START_CURSOR) / (ENDING_CURSOR - START_CURSOR);
    const donePercentage = doneFraction * 100;
    const donePercentageString = donePercentage.toFixed(2) + "%";
    console.log(donePercentageString);

    if (cursor >= ENDING_CURSOR) {
      console.log("Met ending cursor");
      logFileEndContents.message = "SUCCESS";
      continueRunning = false;
      break;
    }

    await timeoutPromise(RUN_DELAY);
  }

  // Write log end
  const scriptEndedDate = new Date();
  const scriptEndedStr = scriptEndedDate.toISOString();
  const runTimeS =
    (scriptEndedDate.getTime() - scriptStartedDate.getTime()) / 1000;

  logFileEndContents.endedAt = scriptEndedStr;
  logFileEndContents.runTimeS = runTimeS;
  logFileEndContents.endCursor = cursor;

  const logEndFileName = scriptStartedFilename + "-end.txt";
  const logEndFilePath = join(OUT_FOLDER, logEndFileName);
  fs.writeFileSync(logEndFilePath, JSON.stringify(logFileEndContents));

  console.log("PH Scraper ended");
};

main();
