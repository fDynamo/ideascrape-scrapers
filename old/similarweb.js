const puppeteer = require('puppeteer-extra');
const fs = require('node:fs');

/**
 * NOTE: This is kinda slow due to some weird posture challenge
 */

const OUT_FILE = './out/raw/similarweb.txt';
const ERROR_FILE = './out/errors/similarweb.txt';
const RUN_DELAY = 1000;
const RETRY_DELAY = 5000;
const SELECTOR_TIMEOUT = 10000;

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const urls = [
  'https://spellar.ai/',
  'https://owogame.com/',
  'https://agent4.ai/?ref=taaft&utm_source=taaft&utm_medium=referral',
  'https://sshfsmanager.com',
  'https://theartificialstack.com',
];

const createSWUrl = (siteUrl) => {
  siteUrl = siteUrl.replace('http://', '');
  siteUrl = siteUrl.replace('https://', '');
  siteUrl = siteUrl.replace('www.', '');
  const lastSlashIndex = siteUrl.lastIndexOf('/');
  if (lastSlashIndex > 0) {
    siteUrl = siteUrl.substring(0, lastSlashIndex);
  }

  const similarwebUrl = 'https://www.similarweb.com/website/';
  siteUrl = similarwebUrl + siteUrl;
  return siteUrl;
};

const PAGE_NUMS = 2;
const MAX_RETRIES = 2;
puppeteer.launch({ headless: 'new' }).then(async (browser) => {
  const pages = [];
  for (let i = 0; i < PAGE_NUMS; i++) {
    const page = await browser.newPage();
    pages.push(page);
  }

  const numVisitsSelector =
    '#overview > div > div > div > div.wa-overview__column.wa-overview__column--engagement > div.engagement-list > div:nth-child(1) > p.engagement-list__item-value';
  const monthChangeSelector =
    '#traffic > div > div > div.wa-traffic__main-content > div.engagement-list > div:nth-child(2) > p.engagement-list__item-value > span';

  await Promise.all(
    pages.map(async (_, pageIndex, pagesArr) => {
      let numRetries = 0;
      for (let i = pageIndex; i < urls.length; i += PAGE_NUMS) {
        const page = pagesArr[pageIndex];
        const siteUrl = urls[i];
        const url = createSWUrl(siteUrl);

        try {
          console.log('START', pageIndex, i, url);
          await page.goto(url);
          await page.waitForSelector(numVisitsSelector, {
            timeout: SELECTOR_TIMEOUT,
          });
          const pageData = await page.evaluate(
            async (numVisitsSelector, monthChangeSelector) => {
              const visitsP = document.querySelector(numVisitsSelector);
              let numVisits = '';
              if (visitsP) numVisits = visitsP.innerText;

              const monthChangeSpan =
                document.querySelector(monthChangeSelector);
              let monthChange = '';
              if (monthChangeSpan) monthChange = monthChange.innerText;

              return {
                numVisits,
                monthChange,
              };
            },
            numVisitsSelector,
            monthChangeSelector
          );

          fs.appendFileSync(OUT_FILE, JSON.stringify({ ...pageData, url }));
          console.log('DONE', pageIndex, i, url);
        } catch (error) {
          const errorStr = (error + '').substring(0, 20);
          console.error('ERROR', pageIndex, i, url, errorStr);
          numRetries++;

          if (numRetries >= MAX_RETRIES) {
            numRetries = 0;
            console.error('SAVING TO ERROR', pageIndex, i, url);
            fs.appendFileSync(
              ERROR_FILE,
              '\n' +
                JSON.stringify({
                  pageIndex,
                  urlIndex: i,
                  url,
                  error: error + '',
                })
            );
          } else {
            console.error('RETRYING', pageIndex, i, url);
            await page.close();
            pagesArr[pageIndex] = await browser.newPage();
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            i -= PAGE_NUMS;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, RUN_DELAY));
      }

      return true;
    })
  );

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    await page.close();
  }

  await browser.close();
});
