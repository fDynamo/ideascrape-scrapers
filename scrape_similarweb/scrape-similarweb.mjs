import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { join } from "path";
import { evaluateSimilarWebPage } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import { convertObjKeysToHeader } from "../helpers/index.js";
import { arraySafeFlatten } from "../helpers/flat-array-safe.mjs";
import { getOutFolder } from "../helpers/get-paths.js";

const OUT_SIMILARWEB_FOLDER = getOutFolder("scrape_similarweb");

const NAV_TIMEOUT = 5 * 60 * 1000;
const WAIT_TIMEOUT = 5 * 60 * 1000;

puppeteer.use(StealthPlugin());

const main = async () => {
  console.log("scrape-similarweb started");

  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_SIMILARWEB_FOLDER,
    startDate,
    {}
  );

  const logEndContents = {};

  let browser = null;
  let swPage = null;
  try {
    browser = await puppeteer.launch({ headless: "new" });

    swPage = await browser.newPage();
    await swPage.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    swPage.setDefaultNavigationTimeout(NAV_TIMEOUT);

    const requestStartedDate = new Date();
    const requestStartedStr = requestStartedDate.toISOString();

    const urls = [
      "systoolsgroup.com",
      "amazon.com",
      "04-x.com",
      "188betgg.vip",
    ];
    const urlToTest = urls[3];
    const similarwebUrl = "https://www.similarweb.com/website/" + urlToTest;
    await swPage.goto(similarwebUrl);

    const tasksSelector = "div.wa-overview__row";
    await swPage.waitForSelector(tasksSelector, { timeout: WAIT_TIMEOUT });

    const results = [await swPage.evaluate(evaluateSimilarWebPage)];

    const requestEndedDate = new Date();
    const requestEndedStr = requestEndedDate.toISOString();

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
    const outFilePath = join(OUT_SIMILARWEB_FOLDER, outFileName);
    const csvWriter = createObjectCsvWriter({
      path: outFilePath,
      header,
    });

    csvWriter.writeRecords(recordsToWrite);

    logEndContents.message = "Success";
  } catch (error) {
    logEndContents.error = "" + error;
  }

  if (swPage) await swPage.close();
  if (browser) await browser.close();

  logEndScrape(OUT_SIMILARWEB_FOLDER, startDate, logEndContents);

  console.log("scrape-similarweb ended");
};

main();
