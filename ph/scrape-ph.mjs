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
const DEFAULT_ENDING_CURSOR = 3000;

const cliArgs = getArgs();
const inEndingCursor = cliArgs[0];
const ENDING_CURSOR = inEndingCursor
  ? parseInt(inEndingCursor)
  : DEFAULT_ENDING_CURSOR;

const main = async () => {
  console.log("PH Scraper started");
  let cursor = 0;
  let continueRunning = true;

  // Write log
  const scriptStartedDate = new Date();
  const scriptStartedStr = scriptStartedDate.toISOString();
  const scriptStartedFilename = getDateFilename(scriptStartedDate);

  const logFileName = scriptStartedFilename + "-log.txt";
  const logFilePath = join(OUT_FOLDER, logFileName);
  const logFileStartContents = {
    startedAt: scriptStartedStr,
    args: cliArgs,
  };
  fs.writeFileSync(logFilePath, JSON.stringify(logFileStartContents));

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

      const recordsToWrite = items.map((obj) => {
        obj._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
          nodeDate,
        };
        return flatten(obj);
      });

      if (!csvWriter) {
        const header = Object.keys(recordsToWrite[0]).map((headerTitle) => {
          return { headerTitle };
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
    const doneFraction = cursor / ENDING_CURSOR;
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

  // Add ending notes
  const scriptEndedDate = new Date();
  const scriptEndedStr = scriptEndedDate.toISOString();
  const runTimeS =
    (scriptEndedDate.getTime() - scriptStartedDate.getTime()) / 1000;

  logFileEndContents.endedAt = scriptEndedStr;
  logFileEndContents.runTimeS = runTimeS;
  logFileEndContents.endCursor = cursor;

  fs.appendFileSync(logFilePath, "\n" + JSON.stringify(logFileEndContents));
  console.log("PH Scraper ended");
};

main();
