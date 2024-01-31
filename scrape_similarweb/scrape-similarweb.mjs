import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { extname, join } from "path";
import { evaluateSimilarWebPage } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import {
  convertObjKeysToHeader,
  getArgs,
  timeoutPromise,
} from "../helpers/index.js";
import { arraySafeFlatten } from "../helpers/flat-array-safe.mjs";
import { getOutFolder } from "../helpers/get-paths.js";
import registerGracefulExit from "../helpers/graceful-exit.js";
import { readFileSync, readdirSync } from "fs";

const OUT_SIMILARWEB_FOLDER = getOutFolder("scrape_similarweb");

const NAV_TIMEOUT = 1 * 60 * 1000;
const WAIT_TIMEOUT = 20 * 1000;
const RUN_DELAY = 2000;
const RETRY_DELAY = 1 * 1000;
const MAX_TRIES = 3;

const SOURCE_FILEPATH_KEY = "source";
const LATEST_FAILED_FILEPATH_KEY = "latest_failed";
const LATEST_NOT_REACHED_FILEPATH_KEY = "latest_not_reached";

const FAILED_FILE_SUFFIX = "-failed";
const NOT_REACHED_FILE_SUFFIX = "-not-reached";

let urlsFilepath = SOURCE_FILEPATH_KEY;
let startIndex = 0;
let endIndex = 0;

// Handle arguments
const cliArgs = getArgs();
const arg1 = cliArgs[0];

if (arg1) {
  urlsFilepath = arg1;

  // Parse second and third args for start and stop
  const arg2 = cliArgs[1];
  const arg3 = cliArgs[2];

  if (arg2) {
    if (arg3) {
      startIndex = parseInt(arg2);
      endIndex = parseInt(arg3);
    } else {
      endIndex = parseInt(arg2);
    }
  }
}

// Get urls file path if source
if (urlsFilepath == SOURCE_FILEPATH_KEY) {
  urlsFilepath = join(
    getOutFolder("source_extracts"),
    "similarweb_urls_extract.csv"
  );
}
// Get urls file path if latest
if (
  urlsFilepath == LATEST_FAILED_FILEPATH_KEY ||
  urlsFilepath == LATEST_NOT_REACHED_FILEPATH_KEY
) {
  const files = readdirSync(OUT_SIMILARWEB_FOLDER);

  let oldestFilename = "";
  const fileSuffix =
    urlsFilepath == LATEST_FAILED_FILEPATH_KEY
      ? FAILED_FILE_SUFFIX
      : NOT_REACHED_FILE_SUFFIX;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (extname(file) != ".csv" || !file.includes(fileSuffix)) continue;

    if (!oldestFilename) oldestFilename = file;
    else {
      if (file > oldestFilename) oldestFilename = file;
    }
  }

  if (!oldestFilename) {
    throw new Error("File not found for " + urlsFilepath);
  }
  const oldestFilepath = join(OUT_SIMILARWEB_FOLDER, oldestFilename);
  urlsFilepath = oldestFilepath;
}

const urlsFileContents = readFileSync(urlsFilepath, "utf-8");
const urls = urlsFileContents.split("\n");
const lastIndex = endIndex ? Math.min(endIndex, urls.length) : urls.length;

puppeteer.use(StealthPlugin());

const main = async () => {
  console.log("scrape-similarweb started");

  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_SIMILARWEB_FOLDER,
    startDate,
    {
      cliArgs,
      urlsFilepath: urlsFilepath,
      countUrlsToScrape: lastIndex - startIndex,
    }
  );

  const endLogContents = {};

  // Variables that are logged at the end
  let urlToScrape = "";
  let urlToScrapeIndex = startIndex;
  let countSuccessfulScrapes = 0;

  // csv writers
  let csvWriter = null;
  const failedCsvWriter = createObjectCsvWriter({
    path: join(
      OUT_SIMILARWEB_FOLDER,
      scriptStartedFilename + FAILED_FILE_SUFFIX + ".csv"
    ),
    header: [{ id: "url", title: "url" }],
  });

  // Puppeteer variables
  let browser = null;
  let swPage = null;

  try {
    const wsEndpoint = `wss://${process.env.BRIGHTDATA_USERNAME}:${process.env.BRIGHTDATA_PASSWORD}@${process.env.BRIGHTDATA_HOST_URL}`;
    console.log(wsEndpoint);
    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });

    swPage = await browser.newPage();
    await swPage.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    swPage.setDefaultNavigationTimeout(NAV_TIMEOUT);

    const requestStartedDate = new Date();
    const requestStartedStr = requestStartedDate.toISOString();

    let triesCounter = 0;

    // Register graceful exit
    let forcedStop = false;
    const FORCED_STOP_ERROR_STRING = "Forced stop";
    registerGracefulExit(() => {
      forcedStop = true;
    });

    for (; urlToScrapeIndex < lastIndex; urlToScrapeIndex++) {
      try {
        // Handle forced stop
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        urlToScrape = urls[urlToScrapeIndex];
        if (urlToScrape == "url") continue;

        console.log("START", urlToScrape);
        const similarwebUrl =
          "https://www.similarweb.com/website/" + urlToScrape;
        await swPage.goto(similarwebUrl);

        const overviewSelector = "div.wa-overview__row";
        await swPage.waitForSelector(overviewSelector, {
          timeout: WAIT_TIMEOUT,
        });

        const results = await swPage.evaluate(evaluateSimilarWebPage);

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();

        results._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
        };
        const recordToWrite = arraySafeFlatten(results);

        // Write results
        if (!csvWriter) {
          csvWriter = createObjectCsvWriter({
            path: join(OUT_SIMILARWEB_FOLDER, scriptStartedFilename + ".csv"),
            header: convertObjKeysToHeader(recordToWrite),
          });
        }
        await csvWriter.writeRecords([recordToWrite]);

        countSuccessfulScrapes += 1;

        console.log("END", urlToScrape);

        // Print percentage
        const normalizedIndex = urlToScrapeIndex + 1 - startIndex;
        const normalizedLastIndex = lastIndex - startIndex;
        const doneFraction = normalizedIndex / normalizedLastIndex;
        const donePercentage = doneFraction * 100;
        const donePercentageString = donePercentage.toFixed(2) + "%";
        console.log("PROGRESS", donePercentageString);

        await timeoutPromise(RUN_DELAY);
      } catch (error) {
        const errString = error + "";
        const NAV_ERROR_STRING = " Navigation timeout of";
        const isNavTimeout = errString.includes(NAV_ERROR_STRING);
        const isForcedStop = errString.includes(FORCED_STOP_ERROR_STRING);

        console.log("ERROR", error);
        triesCounter++;

        if (isForcedStop) {
          throw error;
        }

        if (isNavTimeout && triesCounter < MAX_TRIES) {
          await swPage.close();
          swPage = await browser.newPage();
          swPage.setDefaultNavigationTimeout(NAV_TIMEOUT);
          await timeoutPromise(RETRY_DELAY);
          i--;
        } else {
          console.log("URL SCRAPE FAILED!", urlToScrape);
          triesCounter = 0;

          // Write url in error file
          failedCsvWriter.writeRecords([{ url: urlToScrape }]);
        }
        continue;
      }
    }

    urlToScrape = "";
    urlToScrapeIndex++;

    endLogContents.message = "Success";
  } catch (error) {
    endLogContents.error = "" + error;
  }

  if (swPage) await swPage.close();
  if (browser) await browser.close();

  // Write remaining urls
  if (urlToScrapeIndex < urls.length) {
    const remainingUrls = urls.slice(urlToScrapeIndex);
    const toRecordNotReached = remainingUrls.map((urlToScrape) => {
      return { url: urlToScrape };
    });
    if (toRecordNotReached.length) {
      const notReachedCsvWriter = createObjectCsvWriter({
        path: join(
          OUT_SIMILARWEB_FOLDER,
          scriptStartedFilename + NOT_REACHED_FILE_SUFFIX + ".csv"
        ),
        header: [{ id: "url", title: "url" }],
      });
      await notReachedCsvWriter.writeRecords(toRecordNotReached);
    }
  }

  endLogContents.lastUrlToScrape = urlToScrape;
  endLogContents.lastUrlToScrapeIndex = urlToScrapeIndex;
  endLogContents.countSuccessfulScrapes = countSuccessfulScrapes;

  logEndScrape(OUT_SIMILARWEB_FOLDER, startDate, endLogContents);

  console.log("scrape-similarweb ended");
  process.exit();
};

main();
