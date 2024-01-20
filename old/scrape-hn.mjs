import fs from "fs";
import { getArgs, getDateFilename, timeoutPromise } from "../helpers/index.js";
import { queryPH } from "./graphql-query.js";
import { createObjectCsvWriter } from "csv-writer";
import { flatten } from "flat";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_FOLDER = join(__dirname, "out");

const RUN_DELAY = 250;
const QUERY_TIMEOUT = 5000;
const NUM_THREADS = 6;

let START_CURSOR = 0;
let ENDING_CURSOR = 50000;

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

const main = async () => {
  const threadsList = [];
  for (let i = 0; i < NUM_THREADS; i++) {
    threadsList.push(i);
  }

  // Start by polling recents in show new
  await Promise.all(
    threadsList.map(async (_, threadIndex) => {
      const startI = DEFAULT_START - START_INDEX + threadIndex;
      for (let i = startI; i < MAX_PROCESS; i += NUM_THREADS) {
        const itemId = DEFAULT_START - i;

        if (itemId % 10 == 0)
          console.log(
            "PROGRESS",
            itemId,
            i + " / " + MAX_PROCESS,
            numValidFound + " / " + MAX_VALID
          );

        if (numValidFound >= MAX_VALID) {
          console.log("Maximum valid posts reached!");
          return;
        }

        try {
          const queryUrl =
            "https://hacker-news.firebaseio.com/v0/item/" + itemId + ".json";
          const queryRes = await axios.get(queryUrl, {
            timeout: QUERY_TIMEOUT,
          });
          const { data } = queryRes;
          if (!data) continue;

          const { title, type } = data;
          if (type !== "story") continue;
          if (!title) continue;

          const isValid = title.startsWith("Show HN");
          if (isValid) {
            console.log("VALID FOUND", itemId);
            fs.appendFileSync(OUT_FILE, JSON.stringify(data) + "\n");
            numValidFound++;
          }
        } catch (error) {
          console.log("ERROR", itemId, error + "");
        }

        await new Promise((resolve) => setTimeout(resolve, RUN_DELAY));
      }
    })
  );
};

main();
