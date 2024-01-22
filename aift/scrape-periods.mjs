import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { evaluateTasks } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import { convertObjKeysToHeader, getArgs } from "../helpers/index.js";
import { flatten } from "flat";
import { arraySafeFlatten } from "../helpers/flat-array-safe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_FOLDER = join(__dirname, "out", "periods");

const NAV_TIMEOUT = 5 * 60 * 1000;
const WAIT_TIMEOUT = 5 * 60 * 1000;

let START_YEAR = 2015;
let ENDING_YEAR = 2024;

// Handle CLI arguments
const cliArgs = getArgs();
const arg1 = cliArgs[0];
const arg2 = cliArgs[1];

if (arg1) {
  // If both arguments present, start and end
  if (arg2) {
    START_YEAR = parseInt(arg1);
    ENDING_YEAR = parseInt(arg2);
  }
  // Otherwise, both
  else {
    START_YEAR = parseInt(arg1);
    ENDING_YEAR = parseInt(arg1);
  }
}

puppeteer.use(StealthPlugin());

const main = async () => {
  console.log("aift scrape-periods started");

  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_FOLDER,
    startDate,
    { cliArgs }
  );

  const logEndContents = {};

  let browser = null;
  let aiftPage = null;

  let year = START_YEAR;
  try {
    browser = await puppeteer.launch({ headless: "new" });

    const tasksSelector = "#data_hist";
    aiftPage = await browser.newPage();
    aiftPage.setDefaultNavigationTimeout(NAV_TIMEOUT);

    let csvWriter = null;
    for (; year <= ENDING_YEAR; year++) {
      console.log("start", year);

      const requestStartedDate = new Date();
      const requestStartedStr = requestStartedDate.toISOString();

      await aiftPage.goto("https://theresanaiforthat.com/period/" + year);
      await aiftPage.waitForSelector(tasksSelector, { timeout: WAIT_TIMEOUT });
      const results = await aiftPage.evaluate(evaluateTasks, tasksSelector);

      const requestEndedDate = new Date();
      const requestEndedStr = requestEndedDate.toISOString();

      // Process results
      const recordsToWrite = results.map((obj, objIndex) => {
        obj._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
          year,
          objIndex,
        };
        return arraySafeFlatten(obj);
      });

      // Write results
      if (!csvWriter) {
        const header = convertObjKeysToHeader(recordsToWrite[0]);
        const outFileName = scriptStartedFilename + ".csv";
        const outFilePath = join(OUT_FOLDER, outFileName);
        csvWriter = createObjectCsvWriter({
          path: outFilePath,
          header,
        });
      }
      csvWriter.writeRecords(recordsToWrite);
    }

    logEndContents.message = "Success";
  } catch (error) {
    logEndContents.error = "" + error;
  }

  logEndContents.endYear = year;

  if (aiftPage) await aiftPage.close();
  if (browser) await browser.close();

  logEndScrape(OUT_FOLDER, startDate, logEndContents);

  console.log("aift scrape-periods ended");
};

main();
