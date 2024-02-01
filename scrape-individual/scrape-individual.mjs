import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { extname, join } from "path";
import { evaluateGenericPage } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import {
  convertObjKeysToHeader,
  getArgs,
  getPercentageString,
  timeoutPromise,
} from "../helpers/index.js";
import { arraySafeFlatten } from "../helpers/flat-array-safe.mjs";
import { getOutFolder } from "../helpers/get-paths.js";
import registerGracefulExit from "../helpers/graceful-exit.js";
import { readdirSync } from "fs";
import { readCsvFile } from "../helpers/read-csv.js";

const OUT_INDIVIDUAL_FOLDER = getOutFolder("scrape_individual");

const NAV_TIMEOUT = 1 * 60 * 1000;
const WAIT_TIMEOUT = 20 * 1000;
const RUN_DELAY = 100;
const RETRY_DELAY = 1 * 1000;
const MAX_TRIES = 2;
const MAX_SUCCESSIVE_ERRORS = 10;

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
      startIndex = parseInt(arg2);
    }
  }
}

// Get urls file path if source
if (urlsFilepath == SOURCE_FILEPATH_KEY) {
  urlsFilepath = join(
    getOutFolder("source_extracts"),
    "individual_urls_extract.csv"
  );
}
// Get urls file path if latest
if (
  urlsFilepath == LATEST_FAILED_FILEPATH_KEY ||
  urlsFilepath == LATEST_NOT_REACHED_FILEPATH_KEY
) {
  const files = readdirSync(OUT_INDIVIDUAL_FOLDER);

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
  const oldestFilepath = join(OUT_INDIVIDUAL_FOLDER, oldestFilename);
  urlsFilepath = oldestFilepath;
}

// Read url file
const urlsFileContents = await readCsvFile(urlsFilepath);
const urls = urlsFileContents.map((row) => row.url);
const lastIndex = endIndex ? Math.min(endIndex, urls.length) : urls.length;

puppeteer.use(StealthPlugin());

const main = async () => {
  console.log("scrape-individual started");

  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_INDIVIDUAL_FOLDER,
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
  let countFailedScrapes = 0;

  // csv writers
  let csvWriter = null;
  const failedCsvWriter = createObjectCsvWriter({
    path: join(
      OUT_INDIVIDUAL_FOLDER,
      scriptStartedFilename + FAILED_FILE_SUFFIX + ".csv"
    ),
    header: [
      { id: "url", title: "url" },
      { id: "error", title: "error" },
    ],
  });

  // Puppeteer variables
  let browser = null;
  let page = null;

  const initializePage = async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    await page.setRequestInterception(true);
    await page.setDefaultNavigationTimeout(NAV_TIMEOUT);
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        // If the request is for an image, block it
        request.abort();
      } else {
        // If it's not an image request, allow it to continue
        request.continue();
      }
    });
    return page;
  };

  try {
    // Initialize browser and page
    const USE_BRIGHT_DATA = false;
    if (USE_BRIGHT_DATA) {
      const wsEndpoint = `wss://${process.env.BRIGHTDATA_USERNAME}:${process.env.BRIGHTDATA_PASSWORD}@${process.env.BRIGHTDATA_HOST_URL}`;
      browser = await puppeteer.connect({
        headless: "new",
        browserWSEndpoint: wsEndpoint,
      });
    } else {
      browser = await puppeteer.launch({ headless: "new" });
    }

    page = await initializePage(browser);

    // Variables
    const FORCED_STOP_ERROR_STRING = "Forced stop";
    const SUCCESSIVE_ERROR_STRING = "Max successive errors reached!";

    let countTries = 0;
    let countSuccessiveErrors = 0;

    // Register graceful exit
    let forcedStop = false;
    registerGracefulExit(() => {
      forcedStop = true;
    });

    for (; urlToScrapeIndex < lastIndex; urlToScrapeIndex++) {
      try {
        // Handle forced stop
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        // Handle max successive errors
        if (countSuccessiveErrors >= MAX_SUCCESSIVE_ERRORS) {
          throw new Error(SUCCESSIVE_ERROR_STRING);
        }

        urlToScrape = "https://" + urls[urlToScrapeIndex];
        console.log("START", urlToScrapeIndex, urlToScrape);

        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await page.goto(urlToScrape);

        const results = await page.evaluate(evaluateGenericPage);

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();

        results._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
          urlToScrape,
          urlToScrapeIndex,
        };
        const recordToWrite = arraySafeFlatten(results);

        // Write results
        if (!csvWriter) {
          csvWriter = createObjectCsvWriter({
            path: join(OUT_INDIVIDUAL_FOLDER, scriptStartedFilename + ".csv"),
            header: convertObjKeysToHeader(recordToWrite),
          });
        }
        await csvWriter.writeRecords([recordToWrite]);

        // Print progress
        console.log("END", urlToScrapeIndex, urlToScrape);
        const donePercentageString = getPercentageString(
          urlToScrapeIndex + 1,
          startIndex,
          lastIndex
        );
        console.log("PROGRESS", donePercentageString);

        // Reset variables
        countTries = 0;
        countSuccessiveErrors = 0;

        countSuccessfulScrapes += 1;
        await timeoutPromise(RUN_DELAY);
      } catch (error) {
        const errString = error + "";
        console.log("ERROR", error);

        const isForcedStop = errString.includes(FORCED_STOP_ERROR_STRING);
        if (isForcedStop) {
          throw error;
        }

        const isSuccessiveErrorMaxReached = errString.includes(
          SUCCESSIVE_ERROR_STRING
        );
        if (isSuccessiveErrorMaxReached) {
          throw error;
        }

        const NAV_ERROR_STRING = " Navigation timeout of";
        const isNavTimeout = errString.includes(NAV_ERROR_STRING);

        countTries++;

        if (isNavTimeout && countTries < MAX_TRIES) {
          await page.close();
          page = await initializePage(browser);
          urlToScrapeIndex--;

          await timeoutPromise(RETRY_DELAY);
        } else {
          console.log("URL SCRAPE FAILED!", urlToScrape);
          countTries = 0;
          // Write url in error file
          failedCsvWriter.writeRecords([
            { url: urlToScrape, error: errString },
          ]);

          countFailedScrapes += 1;
          countSuccessiveErrors += 1;

          await timeoutPromise(RUN_DELAY);
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

  if (page) await page.close();
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
          OUT_INDIVIDUAL_FOLDER,
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
  endLogContents.countFailedScrapes = countFailedScrapes;

  logEndScrape(OUT_INDIVIDUAL_FOLDER, startDate, endLogContents);

  console.log("scrape-individual ended");
  process.exit();
};

main();
