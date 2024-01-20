import puppeteer from "puppeteer-extra";
import { logStartScrape, logEndScrape } from "../helpers/logger.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { evaluatePostPage } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createObjectCsvWriter } from "csv-writer";
import {
  convertObjKeysToHeader,
  getArgs,
  timeoutPromise,
} from "../helpers/index.js";
import { flatten } from "flat";
import path from "path";
import { readFileSync, readdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_FOLDER = join(__dirname, "out");
const OUT_POSTS_FOLDER = join(OUT_FOLDER, "posts");

const NAV_TIMEOUT = 45 * 1000;
const WAIT_TIMEOUT = 45 * 1000;
const RUN_DELAY = 1000;
const RETRY_DELAY = 5 * 1000;
const MAX_TRIES = 3;

const LATEST_FILEPATH_KEY = "latest";
let urlsFilepath = LATEST_FILEPATH_KEY;

let START_INDEX = 0;
let END_INDEX = 0;

// Handle CLI arguments
/**
 * First argument: filepath
 * Second argument: Start index
 * Third argument: End index, leave at 0 to go to the end. This is exclusive!
 */
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

// Get urls file path if latest
if (urlsFilepath == LATEST_FILEPATH_KEY) {
  const POST_URLS_FOLDER = path.join(OUT_FOLDER, "post_urls");
  const files = readdirSync(POST_URLS_FOLDER);

  let oldestFilename = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (path.extname(file) != ".json") continue;

    if (!oldestFilename) oldestFilename = file;
    else {
      if (file > oldestFilename) oldestFilename = file;
    }
  }

  const oldestFilepath = path.join(POST_URLS_FOLDER, oldestFilename);
  urlsFilepath = oldestFilepath;
}

// Read urls file
const urlsFileContents = readFileSync(urlsFilepath, "utf-8");
const urlsFileObj = JSON.parse(urlsFileContents);
const postUrlsToScrape = urlsFileObj.urls;
const lastIndex = END_INDEX ? END_INDEX : postUrlsToScrape.length;

const main = async () => {
  console.log("aift scrape-posts started");
  const startDate = new Date();
  const { scriptStartedFilename, scriptStartedStr } = logStartScrape(
    OUT_POSTS_FOLDER,
    startDate,
    { cliArgs, urlsFilepath, countUrlsToScrape: lastIndex }
  );

  const endLogContents = {};

  // Variables to interact with at the end
  let urlToScrape = "";
  let urlToScrapeIndex = START_INDEX;
  const failedToScrapeUrls = [];
  let countSuccessfulScrapes = 0;
  let browser = null;
  let postPage = null;

  try {
    puppeteer.use(StealthPlugin());
    browser = await puppeteer.launch({ headless: "new" });

    postPage = await browser.newPage();
    postPage.setDefaultNavigationTimeout(NAV_TIMEOUT);

    const mainLinkSelector = "a#main_ai_link";
    let triesCounter = 0;

    let csvWriter = null;
    for (let i = START_INDEX; i < lastIndex; i++) {
      urlToScrape = postUrlsToScrape[i];
      urlToScrapeIndex = i;
      if (!urlToScrape) continue;

      try {
        console.log("start scrape", i, urlToScrape);

        const requestStartedDate = new Date();
        const requestStartedStr = requestStartedDate.toISOString();

        await postPage.goto(urlToScrape);
        await postPage.waitForSelector(mainLinkSelector, {
          timeout: WAIT_TIMEOUT,
        });
        const result = await postPage.evaluate(evaluatePostPage);

        const requestEndedDate = new Date();
        const requestEndedStr = requestEndedDate.toISOString();

        console.log("end scrape");

        // Process results
        result._reqMeta = {
          scriptStartedAt: scriptStartedStr,
          startedAt: requestStartedStr,
          endedAt: requestEndedStr,
          postIndex: i,
          postUrl: urlToScrape,
        };
        const recordToWrite = flatten(result);

        // Write to csv file
        if (!csvWriter) {
          const header = convertObjKeysToHeader(recordToWrite);
          const outFileName = scriptStartedFilename + ".csv";
          const outFilePath = join(OUT_POSTS_FOLDER, outFileName);
          csvWriter = createObjectCsvWriter({
            path: outFilePath,
            header,
          });
        }
        csvWriter.writeRecords([recordToWrite]);

        // Update counters
        triesCounter = 0;
        countSuccessfulScrapes += 1;

        // Print percentage
        const normalizedIndex = i - START_INDEX;
        const normalizedLastIndex = lastIndex - START_INDEX;
        const doneFraction = normalizedIndex / normalizedLastIndex;
        const donePercentage = doneFraction * 100;
        const donePercentageString = donePercentage.toFixed(2) + "%";
        console.log("done", donePercentageString);

        await timeoutPromise(RUN_DELAY);
      } catch (error) {
        const errString = error + "";
        const NAV_ERROR_STRING = " Navigation timeout of";
        const SELECTOR_ERROR_STRING = " Waiting for selector";
        const isNavTimeout = errString.includes(NAV_ERROR_STRING);
        const isSelectorTimeout = errString.includes(SELECTOR_ERROR_STRING);

        console.log("ERROR", error);
        triesCounter++;
        if ((isNavTimeout || isSelectorTimeout) && triesCounter < MAX_TRIES) {
          await postPage.close();
          postPage = await browser.newPage();
          postPage.setDefaultNavigationTimeout(NAV_TIMEOUT);
          await timeoutPromise(RETRY_DELAY);
          i--;
        } else {
          console.log("URL SCRAPE FAILED!", urlToScrape);
          triesCounter = 0;
          failedToScrapeUrls.push({ url: urlToScrape, error: errString });
        }
        continue;
      }
    }
  } catch (error) {
    endLogContents.error = "" + error;
  }

  if (postPage) await postPage.close();
  if (browser) await browser.close();

  endLogContents.lastUrlToScrape = urlToScrape;
  endLogContents.lastUrlToScrapeIndex = urlToScrapeIndex;
  endLogContents.failedToScrapeUrls = failedToScrapeUrls;
  endLogContents.countSuccessfulScrapes = countSuccessfulScrapes;

  logEndScrape(OUT_POSTS_FOLDER, startDate, endLogContents);

  console.log("aift scrape-posts ended");
};

main();
