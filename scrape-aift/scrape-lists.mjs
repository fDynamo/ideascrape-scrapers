import puppeteer from "puppeteer-extra";
import path from "path";
import { evaluateTasks } from "./evaluate-functions.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getOutFolder } from "../helpers/get-paths.js";
import registerGracefulExit from "../helpers/graceful-exit.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import { createRunLogger } from "../helpers/run-logger.mjs";
import {
  getArgs,
  getPercentageString,
  timeoutPromise,
} from "../helpers/index.js";
import UserAgent from "user-agents";

const main = async () => {
  const OUT_FOLDER = getOutFolder("scrape_aift_lists");
  const dataHeaders = ["product_url", "count_save", "image_url", "source_url"];
  const runLogger = await createRunLogger(
    "aift-scrape-lists",
    dataHeaders,
    OUT_FOLDER
  );

  // Run variables
  const NAV_TIMEOUT = 5 * 60 * 1000;
  const WAIT_TIMEOUT = 5 * 60 * 1000;
  const RUN_DELAY = 1500;

  // List file
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const LIST_PRESETS_FOLDER = path.join(__dirname, "list-presets");
  let LIST_FILEPATH = path.join(LIST_PRESETS_FOLDER, "all-years.json");

  // Handle CLI arguments
  const cliArgs = getArgs();
  const arg1 = cliArgs[0];

  if (arg1) {
    if (arg1.startsWith("preset-")) {
      const presetName = arg1.replace("preset-", "");
      const presetFilename = presetName + ".json";
      const presetFilepath = path.join(LIST_PRESETS_FOLDER, presetFilename);
      LIST_FILEPATH = presetFilepath;
    } else LIST_FILEPATH = arg1;
  }

  if (!LIST_FILEPATH || !existsSync(LIST_FILEPATH)) {
    console.log("List file not found!", LIST_FILEPATH);
    process.exit();
  }

  // Read urls file
  let instructionList = [];
  try {
    const listFileContents = readFileSync(LIST_FILEPATH, "utf-8");
    const listFileObj = JSON.parse(listFileContents);
    instructionList = listFileObj.list;
  } catch {
    console.log("Cannot read list file!", LIST_FILEPATH);
    process.exit();
  }

  await runLogger.addToStartLog({
    cliArgs,
    instructionList: JSON.stringify(instructionList),
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
  let browser = await initializeBrowser();
  let page = await initializePage(browser);
  let entriesAdded = 0;

  const endLogContents = {};

  // Register graceful exit
  let forcedStop = false;
  registerGracefulExit(() => {
    forcedStop = true;
  });

  const START_INDEX = 0;
  const END_INDEX = instructionList.length;
  for (let i = START_INDEX; i < END_INDEX; i++) {
    if (forcedStop) {
      endLogContents.message = "Forced stop";
      break;
    }
    try {
      const { url, taskSelectors } = instructionList[i];
      await runLogger.addToActionLog({ startedUrl: url });

      const requestStartedDate = new Date();
      const requestStartedStr = requestStartedDate.toISOString();

      await page.goto(url);

      const scrapeResults = [];
      for (let j = 0; j < taskSelectors.length; j++) {
        const tasksSelector = taskSelectors[j];
        await page.waitForSelector(tasksSelector, { timeout: WAIT_TIMEOUT });
        const results = await page.evaluate(evaluateTasks, tasksSelector);
        results.forEach((item) => {
          scrapeResults.push(item);
        });
      }

      const requestEndedDate = new Date();
      const requestEndedStr = requestEndedDate.toISOString();
      const requestDurationS =
        (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

      // Process results
      const recordsToWrite = scrapeResults.map((obj) => {
        return {
          product_url: obj.sourceUrl,
          count_save: obj.countSaves,
          image_url: obj.imageUrl,
          source_url: obj.postUrl,
        };
      });

      // Write results
      await runLogger.addToData(recordsToWrite);

      // Print progress
      const donePercentageString = getPercentageString(
        i + 1,
        START_INDEX,
        END_INDEX
      );
      await runLogger.addToActionLog({
        finishedUrl: url,
        recordsRetrieved: recordsToWrite.length,
        percent: donePercentageString,
        reqStartedAt: requestStartedStr,
        reqEndedAt: requestEndedStr,
        reqDurationS: requestDurationS,
      });
      entriesAdded += recordsToWrite.length;

      await timeoutPromise(RUN_DELAY);
    } catch (error) {
      runLogger.addToErrorLog({
        error: error + "",
      });
      endLogContents.message = "Error";
      endLogContents.error = error + "";
      break;
    }
  }

  if (page) await page.close();
  if (browser) await browser.close();

  // Write log end
  if (!endLogContents.message) {
    endLogContents.message = "Success";
  }
  endLogContents.entriesAdded = entriesAdded;

  await runLogger.addToEndLog(endLogContents);
  await runLogger.stopRunLogger();
  process.exit();
};

main();
