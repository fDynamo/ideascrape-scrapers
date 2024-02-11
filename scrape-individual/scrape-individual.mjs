import puppeteer from "puppeteer-extra";
import { join } from "path";
import { evaluateGenericPage } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  getArgs,
  getPercentageString,
  timeoutPromise,
} from "../helpers/index.js";
import { getOutFolder } from "../helpers/get-paths.js";
import registerGracefulExit from "../helpers/graceful-exit.js";
import { readCsvFile } from "../helpers/read-csv.js";
import { createRunLogger } from "../helpers/run-logger.mjs";
import UserAgent from "user-agents";

const main = async () => {
  // Create runLogger
  const OUT_FOLDER = getOutFolder("individual_scrape");
  const dataHeaders = [
    "url",
    "title",
    "description",
    "favicon_url",
    "twitter_meta_tags",
    "og_meta_tags",
  ];
  const runLogger = await createRunLogger(
    "scrape-individual",
    dataHeaders,
    OUT_FOLDER
  );

  // High level file constants
  const SOURCE_FILEPATH = join(
    getOutFolder("filtered_urls"),
    "filtered_urls.csv"
  );

  // Run constants
  const NAV_TIMEOUT = 30 * 1000;
  const RUN_DELAY = 100;
  const RETRY_DELAY = 1 * 1000;
  const REFRESH_DELAY = 1 * 1000;
  const MAX_TRIES = 2;
  const MAX_SUCCESSIVE_ERRORS = 20;
  const REQUESTS_PER_REFRESH = 10;
  const JUST_A_MOMENT_DELAY = 10 * 1000;
  const DISCONNECTED_DELAY = 20 * 1000;

  // Error constants
  const FORCED_STOP_ERROR_STRING = "Forced stop";
  const SUCCESSIVE_ERROR_STRING = "Max successive errors reached!";
  const NAV_ERROR_SUBSTRING = " Navigation timeout of";
  const INTERNET_DISCONNECTED_ERROR_STRING = "net::ERR_INTERNET_DISCONNECTED";

  // CLI constants
  const CLI_ARG_KEY_SOURCE = "source";

  // Variables
  let urlsFilepath = CLI_ARG_KEY_SOURCE;
  let startIndex = 0;
  let endIndex = 0;
  let urlToScrape = "";
  let runIndex = 0;

  let countSuccessfulScrapes = 0;
  let countFailedScrapes = 0;
  let countTries = 0; // How many tries for one specific url
  let countSuccessiveErrors = 0; // How many errors in a row

  // Handle CLI
  const cliArgs = getArgs();
  const arg1 = cliArgs[0];

  let percentageValue = -1;
  let percentageMultiplier = -1;

  if (arg1) {
    urlsFilepath = arg1;

    // Parse second and third args for start and stop
    const arg2 = cliArgs[1];
    const arg3 = cliArgs[2];

    if (arg2) {
      if (arg3) {
        if (arg2.includes("%")) {
          percentageValue = parseFloat(arg2.replace("%"));
          percentageMultiplier = parseInt(arg3);
        } else {
          startIndex = parseInt(arg2);
          endIndex = parseInt(arg3);
        }
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
  let lastIndex = endIndex ? Math.min(endIndex, urls.length) : urls.length;

  // Handle percentages
  if (percentageValue > 0) {
    const percentageCount = Math.floor((lastIndex * percentageValue) / 100);
    startIndex = percentageCount * percentageMultiplier;
    lastIndex = percentageCount * (percentageMultiplier + 1);
    if (lastIndex > urls.length) lastIndex = urls.length;
  }

  // Log start
  await runLogger.addToStartLog({
    cliArgs,
    urlsFilepath: urlsFilepath,
    countUrlsToScrape: lastIndex - startIndex,
    startIndex,
    lastIndex,
  });

  // Puppeteer initializers
  const initializeBrowser = async () => {
    return await puppeteer.launch({ headless: "new" });
  };

  const initializePage = async (browser) => {
    const page = await browser.newPage();
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    await page.setRequestInterception(true);
    await page.setDefaultNavigationTimeout(NAV_TIMEOUT);
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        request.abort();
      } else {
        request.continue();
      }
    });
    return page;
  };

  // Initialize browser and page
  puppeteer.use(StealthPlugin());
  let browser = await initializeBrowser();
  let page = await initializePage(browser);

  // Puppeteer functions
  const refreshBrowser = async () => {
    await browser.close();
    browser = await initializeBrowser();
    page = await initializePage(browser);

    // Write to log
    await runLogger.addToActionLog({
      message: "refreshing browser",
    });
    await timeoutPromise(REFRESH_DELAY);
  };

  // CSV writers related
  const endLogContents = {
    countUrlsToScrape: lastIndex - startIndex,
    startIndex,
    lastIndex,
  };

  // Register graceful exit
  let forcedStop = false;
  registerGracefulExit(() => {
    forcedStop = true;
    browser.close();
  });

  try {
    for (runIndex = startIndex; runIndex < lastIndex; runIndex++) {
      try {
        // Refresh if needed
        const requestsNum = runIndex - startIndex;
        if (requestsNum > 0 && requestsNum % REQUESTS_PER_REFRESH == 0) {
          await refreshBrowser();
        }

        // Handle max successive errors
        if (countSuccessiveErrors >= MAX_SUCCESSIVE_ERRORS) {
          throw new Error(SUCCESSIVE_ERROR_STRING);
        }

        urlToScrape = urls[runIndex];

        // Make request
        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await runLogger.addToActionLog({
          runIndex,
          urlToScrape,
          message: "start",
          requestStartedStr,
        });

        await page.goto("https://" + urlToScrape);

        await runLogger.addToActionLog({
          message: "navigated to " + urlToScrape,
        });

        let results = await page.evaluate(evaluateGenericPage);

        // Check if we are told to wait
        if (results.pageTitle && results.pageTitle.includes("Just a moment")) {
          await runLogger.addToActionLog({
            message: "waiting for page...",
          });
          await timeoutPromise(JUST_A_MOMENT_DELAY);
          results = await page.evaluate(evaluateGenericPage);
        }

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();
        const requestDurationS =
          (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

        // Process results
        const recordToWrite = {
          url: urlToScrape,
          title: results.pageTitle,
          description: results.pageDescription,
          favicon_url: results.faviconUrl,
          twitter_meta_tags: results.twitterMetaTags,
          og_meta_tags: results.ogMetaTags,
        };

        // Write results
        await runLogger.addToData([recordToWrite]);

        // Print progress
        const donePercentageString = getPercentageString(
          runIndex + 1,
          startIndex,
          lastIndex
        );

        // Write to log
        await runLogger.addToActionLog({
          successUrl: urlToScrape,
          runIndex,
          percent: donePercentageString,
          reqStartedAt: requestStartedStr,
          reqEndedAt: requestEndedStr,
          reqDurationS: requestDurationS,
        });

        // Reset variables
        countTries = 0;
        countSuccessiveErrors = 0;

        // Add to counts
        countSuccessfulScrapes += 1;

        // Handle forced stop
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        await timeoutPromise(RUN_DELAY);
      } catch (error) {
        // Handle forced stop in case of target closed
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        const errString = error + "";

        // Write to log
        await runLogger.addToActionLog({
          runIndex,
          urlToScrape,
          message: "error",
          error: errString,
        });

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
        const isDisconnected = errString.includes(
          INTERNET_DISCONNECTED_ERROR_STRING
        );
        const canRetry = isNavTimeout || isDisconnected;

        countTries++;

        // If too many tries, skip to next url, might be something wrong
        if (canRetry && countTries < MAX_TRIES) {
          if (isDisconnected) {
            await timeoutPromise(DISCONNECTED_DELAY);
          }
          await refreshBrowser();

          // Write to log
          await runLogger.addToActionLog({
            runIndex,
            urlToScrape,
            message: "retrying",
            countTries,
          });

          // Get ready to retry
          runIndex--;
          await timeoutPromise(RETRY_DELAY);
        } else {
          countTries = 0;

          // Write to log
          await runLogger.addToActionLog({
            failedUrl: urlToScrape,
            runIndex,
            message: "FAILED! Skipping",
            error: errString,
          });

          await runLogger.addToFailedLog({
            url: urlToScrape,
            error: errString,
          });

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

  try {
    if (browser) await browser.close();
  } catch {}

  endLogContents.lastUrlToScrape = urlToScrape;
  endLogContents.lastRunIndex = runIndex;
  endLogContents.countSuccessfulScrapes = countSuccessfulScrapes;
  endLogContents.countFailedScrapes = countFailedScrapes;

  await runLogger.addToEndLog(endLogContents);
  await runLogger.stopRunLogger();

  process.exit();
};

main();
