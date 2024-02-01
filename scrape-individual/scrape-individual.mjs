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
import { readCsvFile } from "../helpers/read-csv.js";

const main = async () => {
  // High level file constants
  const OUT_FOLDER = getOutFolder("scrape_individual");
  const FAILED_FILE_SUFFIX = "-failed";
  const LOG_FILE_SUFFIX = "-log";
  const SOURCE_FILEPATH = join(
    getOutFolder("source_extracts"),
    "individual_urls_extract.csv"
  );

  // Run constants
  const NAV_TIMEOUT = 1 * 60 * 1000;
  const WAIT_TIMEOUT = 20 * 1000;
  const RUN_DELAY = 100;
  const RETRY_DELAY = 1 * 1000;
  const MAX_TRIES = 2;
  const MAX_SUCCESSIVE_ERRORS = 10;

  // Error constants
  const FORCED_STOP_ERROR_STRING = "Forced stop";
  const SUCCESSIVE_ERROR_STRING = "Max successive errors reached!";
  const NAV_ERROR_SUBSTRING = " Navigation timeout of";

  // CLI constants
  const CLI_ARG_KEY_SOURCE = "source";

  let urlsFilepath = CLI_ARG_KEY_SOURCE;
  let startIndex = 0;
  let endIndex = 0;

  // Handle CLI
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
  if (urlsFilepath == CLI_ARG_KEY_SOURCE) {
    urlsFilepath = SOURCE_FILEPATH;
  }

  // Read url file
  const urlsFileContents = await readCsvFile(urlsFilepath);
  const urls = urlsFileContents.map((row) => row.url);
  const lastIndex = endIndex ? Math.min(endIndex, urls.length) : urls.length;

  // Log start
  console.log("scrape-individual started");
  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_FOLDER,
    startDate,
    {
      cliArgs,
      urlsFilepath: urlsFilepath,
      countUrlsToScrape: lastIndex - startIndex,
    }
  );

  // File constants
  const OUT_FILE_PATH = join(OUT_FOLDER, scriptStartedFilename + ".csv");
  const LOG_FILE_PATH = join(
    OUT_FOLDER,
    scriptStartedFilename + LOG_FILE_SUFFIX + ".csv"
  );
  const FAILED_FILE_PATH = join(
    OUT_FOLDER,
    scriptStartedFilename + FAILED_FILE_SUFFIX + ".csv"
  );

  // CSV writers
  let mainCsvWriter = null;
  const LOG_CSV_HEADERS = {
    runIndex: true,
    urlToScrape: true,
    status: true,
  };
  const logCsvWriter = createObjectCsvWriter({
    path: LOG_FILE_PATH,
    header: convertObjKeysToHeader(LOG_CSV_HEADERS),
  });
  const FAILED_CSV_HEADERS = {
    url: true,
    error: true,
  };
  const failedCsvWriter = createObjectCsvWriter({
    path: FAILED_FILE_PATH,
    header: convertObjKeysToHeader(FAILED_CSV_HEADERS),
  });

  // Puppeteer initializers
  const initializeBrowser = async () => {
    const USE_BRIGHT_DATA = false;
    if (USE_BRIGHT_DATA) {
      const wsEndpoint = `wss://${process.env.BRIGHTDATA_USERNAME}:${process.env.BRIGHTDATA_PASSWORD}@${process.env.BRIGHTDATA_HOST_URL}`;
      return await puppeteer.connect({
        headless: "new",
        browserWSEndpoint: wsEndpoint,
      });
    } else {
      return await puppeteer.launch({ headless: "new" });
    }
  };

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

  // Initialize browser and page
  puppeteer.use(StealthPlugin());
  const browser = await initializeBrowser();
  let page = await initializePage(browser);

  // Variables that are logged at the end
  let urlToScrape = "";
  let runIndex = 0;
  let countSuccessfulScrapes = 0;
  let countFailedScrapes = 0;
  let countTries = 0;
  let countSuccessiveErrors = 0;
  const endLogContents = {};

  // Register graceful exit
  let forcedStop = false;
  registerGracefulExit(() => {
    forcedStop = true;
  });

  try {
    for (runIndex = startIndex; runIndex < lastIndex; runIndex++) {
      try {
        // Handle forced stop
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        // Handle max successive errors
        if (countSuccessiveErrors >= MAX_SUCCESSIVE_ERRORS) {
          throw new Error(SUCCESSIVE_ERROR_STRING);
        }

        // Make request
        urlToScrape = "https://" + urls[runIndex];
        await logCsvWriter.writeRecords([
          {
            urlToScrape,
            runIndex,
            status: "start",
          },
        ]);
        console.log("START", runIndex, urlToScrape);

        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await page.goto(urlToScrape);

        const results = await page.evaluate(evaluateGenericPage);

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();

        // Process results
        results._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
          urlToScrape,
          runIndex,
        };
        const recordToWrite = arraySafeFlatten(results);

        // Write results
        if (!mainCsvWriter) {
          mainCsvWriter = createObjectCsvWriter({
            path: OUT_FILE_PATH,
            header: convertObjKeysToHeader(recordToWrite),
          });
        }
        await mainCsvWriter.writeRecords([recordToWrite]);

        // Print progress
        console.log("END", runIndex, urlToScrape);
        const donePercentageString = getPercentageString(
          runIndex + 1,
          startIndex,
          lastIndex
        );
        console.log("PROGRESS", donePercentageString);

        // Write to log
        await logCsvWriter.writeRecords([
          {
            urlToScrape,
            runIndex,
            status: "success! " + donePercentageString,
          },
        ]);

        // Reset variables
        countTries = 0;
        countSuccessiveErrors = 0;

        countSuccessfulScrapes += 1;
        await timeoutPromise(RUN_DELAY);
      } catch (error) {
        const errString = error + "";
        console.log("ERROR", error);

        // Write to log
        await logCsvWriter.writeRecords([
          {
            urlToScrape,
            runIndex,
            status: "error: " + errString,
          },
        ]);

        // Decide whether to throw error or not
        const isForcedStop = errString.includes(FORCED_STOP_ERROR_STRING);
        const isSuccessiveErrorMaxReached = errString.includes(
          SUCCESSIVE_ERROR_STRING
        );
        if (isForcedStop || isSuccessiveErrorMaxReached) {
          throw error;
        }

        // Retry on nav time outs
        const isNavTimeout = errString.includes(NAV_ERROR_SUBSTRING);

        countTries++;

        if (isNavTimeout && countTries < MAX_TRIES) {
          // Reinitialize page
          await page.close();
          page = await initializePage(browser);

          // Write to log
          await logCsvWriter.writeRecords([
            {
              urlToScrape,
              runIndex,
              status: "retrying: " + countTries,
            },
          ]);

          // Get ready to retry
          runIndex--;
          await timeoutPromise(RETRY_DELAY);
        } else {
          console.log("URL SCRAPE FAILED!", urlToScrape);
          countTries = 0;

          // Write url in error file
          await failedCsvWriter.writeRecords([
            { url: urlToScrape, error: errString },
          ]);

          countFailedScrapes += 1;
          countSuccessiveErrors += 1;

          await timeoutPromise(RUN_DELAY);
        }

        continue;
      }
    }

    // Process ending variables
    urlToScrape = "";
    runIndex++;
    endLogContents.message = "Success";
  } catch (error) {
    endLogContents.error = "" + error;
  }

  if (page) await page.close();
  if (browser) await browser.close();

  endLogContents.lastUrlToScrape = urlToScrape;
  endLogContents.lastRunIndex = runIndex;
  endLogContents.countSuccessfulScrapes = countSuccessfulScrapes;
  endLogContents.countFailedScrapes = countFailedScrapes;

  logEndScrape(OUT_FOLDER, startDate, endLogContents);

  console.log("scrape-individual ended");
  process.exit();
};

main();
