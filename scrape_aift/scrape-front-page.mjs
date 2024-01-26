import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { evaluateTasks } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import { convertObjKeysToHeader } from "../helpers/index.js";
import { arraySafeFlatten } from "../helpers/flat-array-safe.mjs";
import {
  ensureFoldersExist,
  getMasterOutFolder,
} from "../helpers/get-paths.js";

const OUT_FOLDER = join(getMasterOutFolder(), "aift");
const OUT_FRONT_FOLDER = join(OUT_FOLDER, "front");
ensureFoldersExist([OUT_FOLDER, OUT_FRONT_FOLDER]);

const NAV_TIMEOUT = 5 * 60 * 1000;
const WAIT_TIMEOUT = 5 * 60 * 1000;

puppeteer.use(StealthPlugin());

const main = async () => {
  console.log("aift scrape-front-page started");

  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_FRONT_FOLDER,
    startDate,
    {}
  );

  const logEndContents = {};

  let browser = null;
  let aiftPage = null;
  try {
    browser = await puppeteer.launch({ headless: "new" });

    const tasksSelector = "#data_hist";
    const featuredBarSelector = "#sidebar_right .tasks";
    aiftPage = await browser.newPage();
    await aiftPage.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    aiftPage.setDefaultNavigationTimeout(NAV_TIMEOUT);

    const requestStartedDate = new Date();
    const requestStartedStr = requestStartedDate.toISOString();

    await aiftPage.goto("https://theresanaiforthat.com/");
    await aiftPage.waitForSelector(tasksSelector, { timeout: WAIT_TIMEOUT });
    await aiftPage.waitForSelector(featuredBarSelector, {
      timeout: WAIT_TIMEOUT,
    });
    const resultsMain = await aiftPage.evaluate(evaluateTasks, tasksSelector);
    const resultsFeatured = await aiftPage.evaluate(
      evaluateTasks,
      featuredBarSelector
    );

    const requestEndedDate = new Date();
    const requestEndedStr = requestEndedDate.toISOString();

    // Process results
    resultsMain.forEach((obj) => (obj.inFeaturedBar = false));
    resultsFeatured.forEach((obj) => (obj.inFeaturedBar = true));

    const results = [...resultsMain, ...resultsFeatured];
    const recordsToWrite = results.map((obj, objIndex) => {
      obj._reqMeta = {
        scriptStartedAt: scriptStartedStr,
        startedAt: requestStartedStr,
        endedAt: requestEndedStr,
        objIndex,
      };
      return arraySafeFlatten(obj);
    });

    // Write results
    const header = convertObjKeysToHeader(recordsToWrite[0]);
    const outFileName = scriptStartedFilename + ".csv";
    const outFilePath = join(OUT_FRONT_FOLDER, outFileName);
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

  logEndScrape(OUT_FRONT_FOLDER, startDate, logEndContents);

  console.log("aift scrape-front-page ended");
};

main();
