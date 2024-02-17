import puppeteer from "puppeteer-extra";
import { evaluateSimilarWebPage } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getPercentageString, timeoutPromise } from "../helpers/index.js";
import registerGracefulExit from "../helpers/graceful-exit.js";
import { readCsvFile } from "../helpers/read-csv.js";
import { createRunLogger } from "../helpers/run-logger.mjs";
import UserAgent from "user-agents";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

const main = async () => {
  // Process input arguments
  const argv = yargs(hideBin(process.argv)).argv;
  let { outFolder, domainListFilepath, startIndex, endIndex } = argv;
  if (!outFolder || !domainListFilepath) {
    console.log("Invalid arguments");
    return;
  }
  if (!startIndex) startIndex = 0;
  if (!endIndex) endIndex = 0;

  // Read url file
  const urlsFileContents = await readCsvFile(domainListFilepath);
  const urls = urlsFileContents.map((row) => row.domain);
  const lastIndex = endIndex ? Math.min(endIndex, urls.length) : urls.length;

  // Create runLogger
  const dataHeaders = [
    "domain",
    "total_visits_last_month",
    "total_visits_last_month_change",
    "category_name",
    "data_created_at",
    "company_info",
    "countries_data",
  ];
  const runLogger = await createRunLogger(
    "sup-similarweb-scrape",
    dataHeaders,
    outFolder
  );

  // Run constants
  const NAV_TIMEOUT = 30 * 1000;
  const WAIT_TIMEOUT = 30 * 1000;
  const RUN_DELAY = 1 * 1000;
  const RETRY_DELAY = 1 * 1000;
  const REFRESH_DELAY = 1 * 1000;
  const MAX_TRIES = 3;
  const MAX_SUCCESSIVE_ERRORS = 10;
  const REQUESTS_PER_REFRESH = 5; // As long as this is < MAX_SUCCESSIVE_ERRORS, guarantee we reset browsers in case we get blocked
  const DISCONNECTED_DELAY = 5 * 1000;

  // Error constants
  const FORCED_STOP_ERROR_STRING = "Forced stop";
  const SUCCESSIVE_ERROR_STRING = "Max successive errors reached!";
  const NAV_ERROR_SUBSTRING = " Navigation timeout of";
  const NO_DATA_ERROR_STRING = "Page acccessed but no data in page."; // Similarweb page renders but nothing in it
  const WAIT_FOR_TIMEOUT_ERROR_STRING = "Waited for selectors timeout.";
  const INTERNET_DISCONNECTED_ERROR_STRING = "net::ERR_INTERNET_DISCONNECTED";

  // Log start
  await runLogger.addToStartLog({
    cliArgs,
    domainListFilepath,
    countUrlsToScrape: lastIndex - startIndex,
    startIndex,
    lastIndex,
  });

  // Puppeteer initializers
  const initializeBrowser = async () => {
    return await puppeteer.launch({
      headless: "new",
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
    await runLogger.addToActionLog({
      message: "refreshing browser",
    });
    await timeoutPromise(REFRESH_DELAY);
  };

  // Variables
  let urlToScrape = "";
  let runIndex = 0;
  let countSuccessfulScrapes = 0;
  let countFailedScrapes = 0;
  let countTries = 0;
  let countSuccessiveErrors = 0;

  // CSV writers related
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
        // Handle forced stop
        if (forcedStop) {
          throw new Error(FORCED_STOP_ERROR_STRING);
        }

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
        const similarwebUrl =
          "https://www.similarweb.com/website/" + urlToScrape;

        // Make request
        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await runLogger.addToActionLog({
          runIndex,
          urlToScrape,
          message: "start",
          requestStartedStr,
        });

        await page.goto(similarwebUrl);

        await runLogger.addToActionLog({
          message: "navigated to " + similarwebUrl,
        });

        // Check page type
        const PAGE_TYPE = {
          VALID: "valid",
          NOT_FOUND: "notFound",
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

        let pageType = "";
        try {
          pageType = await Promise.race([validPagePromise, errorPagePromise]);
        } catch {
          throw new Error(WAIT_FOR_TIMEOUT_ERROR_STRING);
        }

        await runLogger.addToActionLog({
          pageType,
        });

        // If not found, log skip
        if (pageType == PAGE_TYPE.NOT_FOUND) {
          // Get time and done percentages
          const requestEndedDate = new Date();
          const requestEndedStr = requestEndedDate.toISOString();
          const requestDurationS =
            (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

          const donePercentageString = getPercentageString(
            runIndex + 1,
            startIndex,
            lastIndex
          );

          // Write to log
          await runLogger.addToActionLog({
            notFoundUrl: urlToScrape,
            message: "not found, skipping",
            runIndex,
            percent: donePercentageString,
            reqStartedAt: requestStartedStr,
            reqEndedAt: requestEndedStr,
            reqDurationS: requestDurationS,
          });
        } else {
          const results = await page.evaluate(evaluateSimilarWebPage);

          const requestEndedDate = new Date();
          const requestEndedStr = requestEndedDate.toISOString();
          const requestDurationS =
            (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

          // See if invalid results
          if (!results.totalVisits && !results.rankGlobal) {
            throw new Error(NO_DATA_ERROR_STRING);
          }

          // Process results
          const recordToWrite = {
            domain: urlToScrape,
            total_visits_last_month: results.totalVisits,
            total_visits_last_month_change: results.totalVisitsChange,
            category_name: results.rankCategoryName,
            data_created_at: results.dataDate,
            company_info: results.companyInfoList,
            countries_data: results.countriesData,
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
            finishedUrl: urlToScrape,
            runIndex,
            percent: donePercentageString,
            reqStartedAt: requestStartedStr,
            reqEndedAt: requestEndedStr,
            reqDurationS: requestDurationS,
          });
        }

        // Reset variables
        countTries = 0;
        countSuccessiveErrors = 0;

        countSuccessfulScrapes += 1;
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

        // Retry
        const isNavTimeout = errString.includes(NAV_ERROR_SUBSTRING);
        const isWaitForTimeout = errString.includes(
          WAIT_FOR_TIMEOUT_ERROR_STRING
        );
        const isInternetDisconnected = errString.includes(
          INTERNET_DISCONNECTED_ERROR_STRING
        );

        const canRetry =
          isInternetDisconnected || isNavTimeout || isWaitForTimeout;

        countTries++;

        if (canRetry && countTries < MAX_TRIES) {
          // Reinitialize browser
          await refreshBrowser();

          if (isInternetDisconnected) {
            await timeoutPromise(DISCONNECTED_DELAY);
          }

          // Write to log
          await runLogger.addToActionLog({
            runIndex,
            urlToScrape,
            message: "retrying",
            countTries,
          });

          await timeoutPromise(RETRY_DELAY);
          // Get ready to retry
          runIndex--;
        } else {
          // For one reason or another, this specific url can't be scraped, so skip
          countTries = 0;

          // Write to log
          await runLogger.addToActionLog({
            failedUrl: urlToScrape,
            runIndex,
            message: "FAILED! Skipping.",
            error: errString,
          });

          // Write url in error file
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
