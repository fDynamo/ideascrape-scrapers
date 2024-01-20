import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { evaluateTasks } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import { convertObjKeysToHeader } from "../helpers/index.js";
import { flatten } from "flat";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_FOLDER = join(__dirname, "out", "front");

const NAV_TIMEOUT = 5 * 60 * 1000;
const WAIT_TIMEOUT = 5 * 60 * 1000;

puppeteer.use(StealthPlugin());

const main = async () => {
  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_FOLDER,
    startDate,
    {}
  );

  const logEndContents = {};

  let browser = null;
  let aiftPage = null;
  try {
    browser = await puppeteer.launch({ headless: "new" });

    const tasksSelector = "#data_hist";
    aiftPage = await browser.newPage();
    aiftPage.setDefaultNavigationTimeout(NAV_TIMEOUT);

    const requestStartedDate = new Date();
    const requestStartedStr = requestStartedDate.toISOString();

    await aiftPage.goto("https://theresanaiforthat.com/");
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
        objIndex,
      };
      return flatten(obj);
    });

    // Write results
    const header = convertObjKeysToHeader(recordsToWrite[0]);
    const outFileName = scriptStartedFilename + ".csv";
    const outFilePath = join(OUT_FOLDER, outFileName);
    const csvWriter = createObjectCsvWriter({
      path: outFilePath,
      header,
    });

    csvWriter.writeRecords(recordsToWrite);

    logEndContents.message = "Success";
  } catch (error) {
    logEndContents.error = "" + error;
  }

  if (aiftPage) await aiftPage.close();
  if (browser) await browser.close();

  logEndScrape(OUT_FOLDER, startDate, logEndContents);
};

main();
