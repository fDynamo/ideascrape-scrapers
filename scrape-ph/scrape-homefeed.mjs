import {
  getArgs,
  timeoutPromise,
  getPercentageString,
} from "../helpers/index.js";
import { queryPH } from "./graphql-query.js";
import { createRunLogger } from "../helpers/run-logger.mjs";
import registerGracefulExit from "../helpers/graceful-exit.js";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

const main = async () => {
  // Process input arguments
  const argv = yargs(hideBin(process.argv)).argv;
  let { outFolder, startIndex, endIndex } = argv;
  if (!outFolder) {
    console.log("Invalid arguments");
    return;
  }
  if (!startIndex) startIndex = 0;
  if (!endIndex) endIndex = 5;

  const dataHeaders = [
    "product_url",
    "count_follower",
    "image_url",
    "listed_at",
    "updated_at",
    "source_url",
  ];
  const runLogger = await createRunLogger(
    "source-ph-scrape",
    dataHeaders,
    outFolder
  );

  // Run variables
  const RUN_DELAY = 1500;
  const RETRY_DELAY = 5000;
  const MAX_RETRIES = 5;

  // Error strings
  const ERR_STRING_NO_ITEMS = "No items retrieved!";
  const ERR_STRING_NO_NEXT_PAGE = "No next page found";
  const ERR_STRING_MAX_RETRIES_REACHED = "Max retries reached!";

  // Start and end cursor defaults
  let START_CURSOR = startIndex;
  let ENDING_CURSOR = endIndex;

  // Register graceful exit
  let forcedStop = false;
  registerGracefulExit(() => {
    forcedStop = true;
  });

  // Handle CLI arguments
  const cliArgs = getArgs();
  const arg1 = cliArgs[0];
  const arg2 = cliArgs[1];

  if (arg1) {
    // If both arguments present, start and end
    if (arg2) {
      START_CURSOR = parseInt(arg1);
      ENDING_CURSOR = parseInt(arg2);
    }
    // Otherwise, only end
    else {
      ENDING_CURSOR = parseInt(arg1);
    }
  }

  // Other variables
  let cursor = 0;
  let entriesAdded = 0;
  let countRetries = 0;

  const endLogContents = {};

  await runLogger.addToStartLog({
    cliArgs,
    startCursor: START_CURSOR,
    endCursor: ENDING_CURSOR,
  });

  for (cursor = START_CURSOR; cursor < ENDING_CURSOR; cursor++) {
    try {
      await runLogger.addToActionLog({ startedCursor: cursor });
      const requestStartedDate = new Date();
      const requestStartedStr = requestStartedDate.toISOString();

      const queryRes = await queryPH(cursor);

      const requestEndedDate = new Date();
      const requestEndedStr = requestEndedDate.toISOString();
      const requestDurationS =
        (requestEndedDate.getTime() - requestStartedDate.getTime()) / 1000;

      const { pageInfo, edges } = queryRes.data.homefeed;
      const { date: nodeDate, items } = edges[0].node;

      if (!items.length) {
        throw new Error(ERR_STRING_NO_ITEMS);
      }

      const recordsToWrite = [];

      items.forEach((obj) => {
        if (!obj.product) return;
        const { product, thumbnailImageUuid } = obj;

        let image_url = "";
        let listed_at = "";
        let updated_at = "";
        let count_follower = 0;
        let source_url = "";
        try {
          image_url = thumbnailImageUuid
            ? "https://ph-files.imgix.net/" + thumbnailImageUuid
            : "";
          listed_at = product.structuredData.datePublished;
          updated_at = product.structuredData.dateModified;
          count_follower = product.followersCount;
          source_url = product.url;
        } catch {}

        recordsToWrite.push({
          product_url: product.websiteUrl,
          image_url,
          listed_at,
          updated_at,
          count_follower,
          source_url,
        });
      });

      await runLogger.addToData(recordsToWrite);

      // Print progress
      const donePercentageString = getPercentageString(
        cursor + 1,
        START_CURSOR,
        ENDING_CURSOR
      );
      await runLogger.addToActionLog({
        finishedCursor: cursor,
        recordsRetrieved: recordsToWrite.length,
        nodeDate,
        percent: donePercentageString,
        reqStartedAt: requestStartedStr,
        reqEndedAt: requestEndedStr,
        reqDurationS: requestDurationS,
      });

      entriesAdded += recordsToWrite.length;

      if (!pageInfo.hasNextPage) {
        throw new Error(ERR_STRING_NO_NEXT_PAGE);
      }

      countRetries = 0;
    } catch (error) {
      const errStr = error + "";

      await runLogger.addToErrorLog({ error: errStr });

      if (errStr == ERR_STRING_NO_ITEMS || errStr == ERR_STRING_NO_NEXT_PAGE) {
        endLogContents.message = "Error";
        endLogContents.error = errStr;
        break;
      }

      // Check if we can retry
      if (countRetries < MAX_RETRIES) {
        countRetries += 1;
        cursor--;
        await timeoutPromise(RETRY_DELAY);
      } else {
        endLogContents.message = "Error";
        endLogContents.error = ERR_STRING_MAX_RETRIES_REACHED;
        break;
      }
    }

    if (forcedStop) {
      endLogContents.message = "Forced stop";
      break;
    }

    if (cursor >= ENDING_CURSOR) {
      endLogContents.message = "Met ending cursor";
      break;
    }

    await timeoutPromise(RUN_DELAY);
  }

  // Write log end
  endLogContents.endCursor = cursor;
  endLogContents.entriesAdded = entriesAdded;

  await runLogger.addToEndLog(endLogContents);
  await runLogger.stopRunLogger();
  process.exit();
};

main();
