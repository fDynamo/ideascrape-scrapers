const puppeteer = require('puppeteer-extra');
const fs = require('node:fs');

/** CONSTANTS */
// File locations
const URLS_FILE = './out/raw/sh_urls.txt';
const OUT_FILE = './out/raw/sh_posts_alternatives.txt';
const ERROR_FILE = './out/errors/sh_posts_alternatives.txt';

// Some parameters
const NUM_PAGES = 1;
const NAV_DELAY = 500;
const RETRY_DELAY = 15000;
const MAX_RETRIES = 2;
const SELECTOR_TIMEOUT = 10000;

// CLI args
const firstArg = process.argv[2];
const START_INDEX = firstArg ? parseInt(firstArg) || 0 : 0;

/** Read file */
const inFileContents = fs.readFileSync(URLS_FILE, 'utf-8');
const inFileLines = inFileContents.trim().split('\n');
const shEntries = inFileLines.map((line) => {
  try {
    const lineObj = JSON.parse(line);
    return lineObj;
  } catch {
    return null;
  }
});

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const scrapeInfoPage = async () => {
  try {
    let latestUpdate = '';
    const timeSelector = 'time[itemprop="dateModified"]';
    const timeEl = document.querySelector(timeSelector);
    if (timeEl) {
      latestUpdate = timeEl.innerText;
    }

    let postInfo = '';
    const postInfoSelector = 'section.text-sm.mt-3 > div > div';
    const postInfoEl = document.querySelector(postInfoSelector);
    if (postInfoEl) {
      postInfo = postInfoEl.innerText;
    }

    return {
      isError: false,
      data: {
        latestUpdate,
        postInfo,
      },
    };
  } catch (error) {
    return { isError: true, error: error + '' };
  }
};

puppeteer.launch({ headless: 'new' }).then(async (browser) => {
  // Initialize pages
  const pagesList = [];
  let doneCounter = START_INDEX;
  for (let i = 0; i < NUM_PAGES; i++) {
    const newPage = await browser.newPage();
    pagesList.push(newPage);
  }

  await Promise.all(
    pagesList.map(async (_, pageIndex) => {
      await new Promise((resolve) =>
        setTimeout(resolve, NAV_DELAY * pageIndex)
      );

      let numRetries = 0;

      for (
        let i = START_INDEX + pageIndex;
        i < shEntries.length;
        i += NUM_PAGES
      ) {
        const page = pagesList[pageIndex];
        const shEntry = shEntries[i];
        if (!shEntry) continue;

        const urlSuffix = shEntry.shUrl;
        if (!urlSuffix) continue;

        const postUrl = 'https://saashub.com' + urlSuffix + '-alternatives';

        console.log('START', i, urlSuffix);
        try {
          /**
           * To get in alternatives page:
           * - Last updated date
           */

          // Scrape info page
          await page.goto(postUrl);
          const titleSelector = 'h2.title[itemprop="name"]';
          await page.waitForSelector(titleSelector, {
            timeout: SELECTOR_TIMEOUT,
          });
          const infoPageRes = await page.evaluate(scrapeInfoPage);

          if (infoPageRes.isError) {
            throw new Error('INFO PAGE ERROR - ' + infoPageRes.error);
          }

          const infoPageData = infoPageRes.data;
          infoPageData.url = postUrl;
          infoPageData.urlSuffix = urlSuffix;
          infoPageData.pageType = 'alt page';
          fs.appendFileSync(OUT_FILE, JSON.stringify(infoPageData) + '\n');

          console.log('DONE', i, urlSuffix);
          await new Promise((resolve) => setTimeout(resolve, NAV_DELAY));
        } catch (error) {
          console.log('ERROR', i, urlSuffix);
          if (numRetries < MAX_RETRIES) {
            numRetries++;
            console.log(
              'RETRYING',
              i,
              urlSuffix,
              numRetries + ' / ' + MAX_RETRIES
            );
            i -= NUM_PAGES;

            await page.close();
            pagesList[pageIndex] = await browser.newPage();

            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            continue;
          } else {
            console.log('RETRIES MAXED OUT, SKIPPING', i, urlSuffix);
            numRetries = 0;
            fs.appendFileSync(
              ERROR_FILE,
              JSON.stringify({
                url: postUrl,
                urlSuffix,
                index: i,
                error: error + '',
              }) + '\n'
            );
          }
        }

        doneCounter += 1;
        console.log(
          'PROGRESS',
          ((doneCounter * 100) / shEntries.length).toFixed(2) + '%'
        );
      }
    })
  );

  // Close pages
  for (let i = 0; i < NUM_PAGES; i++) {
    const page = pagesList[i];
    await page.close();
  }
  await browser.close();
});
