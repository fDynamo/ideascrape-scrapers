import puppeteer from "puppeteer-extra";
import { join } from "path";
import { evaluateSimilarWebPage } from "./evaluate-functions.js";
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
import { createRunLogger } from "../helpers/run-logger.mjs";
import UserAgent from "user-agents";

const main = async () => {
  // Create runLogger
  const OUT_FOLDER = getOutFolder("scrape_similarweb");
  const runLogger = await createRunLogger("scrape_similarweb", OUT_FOLDER);

  // High level file constants
  const SOURCE_FILEPATH = join(
    getOutFolder("source_extracts"),
    "similarweb_urls_extract.csv"
  );
  const OUT_FILE_PATH = join(OUT_FOLDER, runLogger.baseFileName + ".csv");
  const FAILED_FILE_PATH = join(
    OUT_FOLDER,
    runLogger.baseFileName + "-failed.csv"
  );

  // Run constants
  const NAV_TIMEOUT = 2 * 60 * 1000;
  const WAIT_TIMEOUT = 2 * 60 * 1000;
  const RUN_DELAY = 2 * 1000;
  const RETRY_DELAY = 1 * 1000;
  const MAX_TRIES = 2;
  const MAX_SUCCESSIVE_ERRORS = 10;
  const MAX_CAPTCHA_TRIES = 5;
  const REFRESH_DELAY = 5 * 1000;
  const REQUEST_PER_REFRESH = 5;

  // Error constants
  const FORCED_STOP_ERROR_STRING = "Forced stop";
  const SUCCESSIVE_ERROR_STRING = "Max successive errors reached!";
  const NAV_ERROR_SUBSTRING = " Navigation timeout of";
  const NO_VISITS_ERROR_STRING = "No total visits in data";
  const NOT_FOUND_ERROR_STRING = "Similarweb not found";
  const CAPTCHA_BLOCKED_ERROR_STRING = "Captcha blocked too many times!";

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
  await runLogger.addToStartLog({
    cliArgs,
    urlsFilepath: urlsFilepath,
    countUrlsToScrape: lastIndex - startIndex,
  });

  // Puppeteer initializers
  const initializeBrowser = async () => {
    const proxyServer = process.env.BRIGHTDATA_DATA_CENTER_HOST_URL;
    return await puppeteer.launch({
      headless: false,
      args: [`--proxy-server=${proxyServer}`, `--ignore-certificate-errors`],
    });
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

    await page.authenticate({
      username: process.env.BRIGHTDATA_DATA_CENTER_USERNAME,
      password: process.env.BRIGHTDATA_DATA_CENTER_PASSWORD,
    });

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
  let browser = await initializeBrowser();
  let page = await initializePage(browser);

  // Puppeteer functions
  const refreshBrowser = async () => {
    await browser.close();
    browser = await initializeBrowser();
    page = await initializePage(browser);

    // Write to log
    await runLogger.addToLog({
      message: "refreshing browser",
    });
    await timeoutPromise(REFRESH_DELAY);
  };

  // Variables that are logged at the end
  let urlToScrape = "";
  let runIndex = 0;
  let countSuccessfulScrapes = 0;
  let countFailedScrapes = 0;
  let countTries = 0;
  let countSuccessiveErrors = 0;
  let countCaptchaTries = 0;

  // CSV writers related
  let mainCsvWriter = null;
  const failedCsvWriter = createObjectCsvWriter({
    path: FAILED_FILE_PATH,
    header: [
      { id: "url", title: "url" },
      { id: "error", title: "error" },
    ],
  });
  const endLogContents = {};

  // Register graceful exit
  let forcedStop = false;
  registerGracefulExit(() => {
    forcedStop = true;
    browser.close();
  });

  try {
    for (runIndex = startIndex; runIndex < lastIndex; runIndex++) {
      try {
        // Handle max successive errors
        if (countSuccessiveErrors >= MAX_SUCCESSIVE_ERRORS) {
          throw new Error(SUCCESSIVE_ERROR_STRING);
        }

        urlToScrape = urls[runIndex];
        const similarwebUrl =
          "https://www.similarweb.com/website/" + urlToScrape;
        await runLogger.addToLog({
          runIndex,
          urlToScrape,
          status: "start",
        });

        // Make request
        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await page.goto(similarwebUrl);

        await runLogger.addToLog({
          message: "Successful navigation.",
        });

        // Check page type
        const PAGE_TYPE = {
          VALID: "valid",
          NOT_FOUND: "notFound",
          CAPTCHA: "captcha",
        };

        const validPagePromise = new Promise(async (resolve, reject) => {
          try {
            const overviewSelector = "div.wa-overview__row";
            await page.waitForSelector(overviewSelector, {
              timeout: WAIT_TIMEOUT,
            });

            resolve(PAGE_TYPE.VALID);
          } catch (error) {
            reject(error);
          }
        });

        const errorPagePromise = new Promise(async (resolve, reject) => {
          try {
            const errorPageSelector = "h1.error__title";
            await page.waitForSelector(errorPageSelector, {
              timeout: WAIT_TIMEOUT,
            });

            resolve(PAGE_TYPE.NOT_FOUND);
          } catch (error) {
            reject(error);
          }
        });

        const captchaPagePromise = new Promise(async (resolve, reject) => {
          try {
            const captchaPageSelector =
              "div.sec-container div#sec-text-container";
            await page.waitForSelector(captchaPageSelector, {
              timeout: WAIT_TIMEOUT,
            });

            resolve(PAGE_TYPE.CAPTCHA);
          } catch (error) {
            reject(error);
          }
        });

        const pageType = await Promise.race([
          validPagePromise,
          errorPagePromise,
          captchaPagePromise,
        ]);

        await runLogger.addToLog({
          pageType,
        });

        if (pageType == PAGE_TYPE.NOT_FOUND) {
          throw new Error(NOT_FOUND_ERROR_STRING);
        } else if (pageType == PAGE_TYPE.CAPTCHA) {
          countCaptchaTries++;
          if (countCaptchaTries >= MAX_CAPTCHA_TRIES) {
            throw new Error(CAPTCHA_BLOCKED_ERROR_STRING);
          }

          // Refresh and redo this iteration
          await refreshBrowser();
          runIndex--;
          continue;
        }

        const results = await page.evaluate(evaluateSimilarWebPage);

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();
        const requestDurationS =
          (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

        // See if invalid results
        if (!results.totalVisits) {
          throw new Error(NO_VISITS_ERROR_STRING);
        }

        // Process results
        results._reqMeta = {
          urlToScrape,
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
        const donePercentageString = getPercentageString(
          runIndex + 1,
          startIndex,
          lastIndex
        );

        // Write to log
        await runLogger.addToLog({
          runIndex,
          urlToScrape,
          status: "success",
          percent: donePercentageString,
          reqStartedAt: requestStartedStr,
          reqEndedAt: requestEndedStr,
          reqDurationS: requestDurationS,
        });

        // Reset variables
        countTries = 0;
        countSuccessiveErrors = 0;
        countCaptchaTries = 0;

        countSuccessfulScrapes += 1;
        await timeoutPromise(RUN_DELAY);

        // Handle forced stop
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        // Refresh if needed
        const requestsNum = runIndex - startIndex;
        if (requestsNum && requestsNum % REQUEST_PER_REFRESH == 0) {
          await refreshBrowser();
        }
      } catch (error) {
        // Handle forced stop in case of target closed
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

        const errString = error + "";

        // Write to log
        await runLogger.addToLog({
          runIndex,
          urlToScrape,
          status: "error",
          error: errString,
        });

        // Decide whether to throw error or not
        const isForcedStop = errString.includes(FORCED_STOP_ERROR_STRING);
        const isSuccessiveErrorMaxReached = errString.includes(
          SUCCESSIVE_ERROR_STRING
        );
        const isCaptchaBlocked = errString.includes(
          CAPTCHA_BLOCKED_ERROR_STRING
        );
        if (isForcedStop || isSuccessiveErrorMaxReached || isCaptchaBlocked) {
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
          await runLogger.addToLog({
            runIndex,
            urlToScrape,
            status: "retrying",
            countTries,
          });

          // Get ready to retry
          runIndex--;
          await timeoutPromise(RETRY_DELAY);
        } else {
          countTries = 0;

          // Write to log
          await runLogger.addToLog({
            runIndex,
            urlToScrape,
            status: "FAILED!",
            error: errString,
          });

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
