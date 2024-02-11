import puppeteer from "puppeteer-extra";
import { evaluatePostPage } from "./evaluate-functions.js";
import {
  getArgs,
  getPercentageString,
  timeoutPromise,
} from "../helpers/index.js";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import registerGracefulExit from "../helpers/graceful-exit.js";
import { getOutFolder } from "../helpers/get-paths.js";
import { createRunLogger } from "../helpers/run-logger.mjs";
import UserAgent from "user-agents";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const main = async () => {
  const OUT_FOLDER = getOutFolder("scrape_aift_posts");
  const dataHeaders = [
    "product_url",
    "count_save",
    "image_url",
    "source_url",
    "listed_at",
    "updated_at",
  ];
  const runLogger = await createRunLogger(
    "aift-scrape-posts",
    dataHeaders,
    OUT_FOLDER
  );

  // Run constants
  const NAV_TIMEOUT = 10 * 1000;
  const WAIT_TIMEOUT = 10 * 1000;
  const RUN_DELAY = 1 * 1000;
  const RETRY_DELAY = 5 * 1000;
  const MAX_RETRIES = 3;

  // Error strings
  const ERROR_STRING_NAVIGATION = "Navigation timeout of";
  const ERROR_STRING_SELECTOR = "Waiting for selector";
  const ERROR_STRING_FORCED_STOP = "Forced stop";
  const ERROR_STRING_CANT_RETRY = "Error but can't retry!";

  // Initializer variables
  const FILEPATH_KEYS = ["all", "latest"];
  let urlsFilepath = FILEPATH_KEYS[1];
  let START_INDEX = 0;
  let END_INDEX = 0;

  // Handle CLI arguments
  const cliArgs = getArgs();
  const arg1 = cliArgs[0];

  if (arg1) {
    urlsFilepath = arg1;

    // Parse second and third args for start and stop
    const arg2 = cliArgs[1];
    const arg3 = cliArgs[2];

    if (arg2) {
      if (arg3) {
        START_INDEX = parseInt(arg2);
        END_INDEX = parseInt(arg3);
      } else {
        START_INDEX = parseInt(arg2);
      }
    }
  }

  // Get urls file path if using a key
  if (FILEPATH_KEYS.includes(urlsFilepath)) {
    const POST_URLS_FOLDER = getOutFolder("scrape_aift_post_urls");
    const filename = urlsFilepath + ".json";
    urlsFilepath = join(POST_URLS_FOLDER, filename);
  }

  // Read urls file
  if (!urlsFilepath || !existsSync(urlsFilepath)) {
    console.log("URLs file not found!", urlsFilepath);
    process.exit();
  }

  let postUrlsToScrape = [];

  try {
    const urlsFileContents = readFileSync(urlsFilepath, "utf-8");
    const urlsFileObj = JSON.parse(urlsFileContents);
    postUrlsToScrape = urlsFileObj.urls;
  } catch {
    console.log("Cant read URLs file!", urlsFilepath);
    process.exit();
  }

  const lastIndex = END_INDEX ? END_INDEX : postUrlsToScrape.length;

  await runLogger.addToStartLog({
    cliArgs,
    startIndex: START_INDEX,
    endIndex: END_INDEX,
    lastIndex,
    urlsFilepath,
  });

  // Puppeteer initializers
  puppeteer.use(StealthPlugin());
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
    await page.setDefaultNavigationTimeout(NAV_TIMEOUT);
    return page;
  };

  // Variables
  let urlToScrape = "";
  let runIndex = 0;
  let countSuccessfulScrapes = 0;
  let countFailedScrapes = 0;
  let countRetries = 0;

  let browser = await initializeBrowser();
  let page = await initializePage(browser);

  const resetBrowser = async () => {
    await browser.close();
    browser = await initializeBrowser();
    page = await initializePage(browser);
  };

  const endLogContents = {};

  // Some scraping constants
  const mainLinkSelector = "a#main_ai_link";

  // Forced stop
  let forcedStop = false;
  registerGracefulExit(() => {
    forcedStop = true;
  });

  try {
    for (runIndex = START_INDEX; runIndex < lastIndex; runIndex++) {
      if (forcedStop) {
        throw new Error(ERROR_STRING_FORCED_STOP);
      }

      urlToScrape = postUrlsToScrape[runIndex];
      if (!urlToScrape) continue;

      try {
        await runLogger.addToActionLog({ startedUrl: urlToScrape });
        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await page.goto(urlToScrape);
        await page.waitForSelector(mainLinkSelector, {
          timeout: WAIT_TIMEOUT,
        });
        const result = await page.evaluate(evaluatePostPage);

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();
        const requestDurationS =
          (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

        // Process results
        let { firstFeaturedText } = result.productInfo;
        if (firstFeaturedText) {
          const firstFeaturedSeparator = "was first featured on";
          const tmpId = firstFeaturedText.indexOf(firstFeaturedSeparator);
          firstFeaturedText = firstFeaturedText
            .substring(tmpId + firstFeaturedSeparator.length)
            .trim();
          if (firstFeaturedText.includes(".")) {
            firstFeaturedText = firstFeaturedText.substring(
              0,
              firstFeaturedText.length - 1
            );
          }
        }

        const recordToWrite = {
          product_url: result.productInfo.productLink,
          count_save: result.ratings.countSaves,
          image_url: result.productInfo.imageUrl,
          source_url: urlToScrape,
          listed_at: result.productInfo.launchDateText,
          updated_at: firstFeaturedText,
        };

        // Write to csv file
        await runLogger.addToData([recordToWrite]);

        // Reset counters
        countRetries = 0;

        // Print progress
        const donePercentageString = getPercentageString(
          runIndex + 1,
          START_INDEX,
          lastIndex
        );
        await runLogger.addToActionLog({
          finishedUrl: urlToScrape,
          runIndex,
          percent: donePercentageString,
          reqStartedAt: requestStartedStr,
          reqEndedAt: requestEndedStr,
          reqDurationS: requestDurationS,
        });
        countSuccessfulScrapes += 1;

        await resetBrowser();
        await timeoutPromise(RUN_DELAY);
      } catch (error) {
        const errString = error + "";
        await runLogger.addToErrorLog({
          urlToScrape,
          error: errString,
        });

        const isNavTimeout = errString.includes(ERROR_STRING_NAVIGATION);
        const isSelectorTimeout = errString.includes(ERROR_STRING_SELECTOR);
        const isForcedStop = errString.includes(ERROR_STRING_FORCED_STOP);

        if (isForcedStop) {
          throw error;
        }

        if ((isNavTimeout || isSelectorTimeout) && countRetries < MAX_RETRIES) {
          countRetries++;
          await runLogger.addToActionLog({
            retryingUrl: urlToScrape,
            countRetries,
          });

          await resetBrowser();
          await timeoutPromise(RETRY_DELAY);
          runIndex--;
        } else {
          await runLogger.addToErrorLog({
            urlToScrape,
            error: ERROR_STRING_CANT_RETRY,
          });

          await runLogger.addToFailedLog({
            url: urlToScrape,
            countRetries,
            errString,
          });
          countRetries = 0;
          countFailedScrapes++;
        }

        await timeoutPromise(RUN_DELAY);
        continue;
      }
    }
  } catch (error) {
    endLogContents.error = "" + error;
  }

  if (page) await page.close();
  if (browser) await browser.close();

  endLogContents.lastUrlToScrape = urlToScrape;
  endLogContents.lastRunIndex = runIndex;
  endLogContents.countSuccessfulScrapes = countSuccessfulScrapes;
  endLogContents.countFailedScrapes = countFailedScrapes;

  await runLogger.addToEndLog(endLogContents);
  await runLogger.stopRunLogger();
  process.exit();
};

main();
