const puppeteer = require('puppeteer-extra');
const fs = require('node:fs');
const { fixShUrl } = require('../helpers/stringFormatters');

const OUT_FILE = './out/raw/sh_urls.txt';
const RUN_DELAY = 1000;
const START_INDEX = 1;
const CATEGORY_URLS = [
  'https://www.saashub.com/best-ecommerce-software',
  'https://www.saashub.com/best-ecommerce-platform-software',
  'https://www.saashub.com/best-customer-feedback-software',
  'https://www.saashub.com/best-ecommerce-tools-software',
  'https://www.saashub.com/best-inventory-management-software',
  'https://www.saashub.com/best-product-information-management-software',
  'https://www.saashub.com/best-discount-codes-software',
  'https://www.saashub.com/best-shopping-cart-software',
  'https://www.saashub.com/best-ecommerce-analytics-software',
  'https://www.saashub.com/best-payment-gateways-software',
  'https://www.saashub.com/best-order-fulfillment-software',
  'https://www.saashub.com/best-price-comparison-software',
  'https://www.saashub.com/best-project-management-software',
  'https://www.saashub.com/best-task-management-software',
  'https://www.saashub.com/best-team-collaboration-software',
  'https://www.saashub.com/best-workflow-automation-software',
  'https://www.saashub.com/best-knowledge-base-software',
  'https://www.saashub.com/best-calendar-and-scheduling-software',
  'https://www.saashub.com/best-project-retrospectives-software',
  'https://www.saashub.com/best-agile-project-management-software',
  'https://www.saashub.com/best-risk-management-software',
  'https://www.saashub.com/best-gantt-charts-software',
  'https://www.saashub.com/best-budgeting-and-forecasting-software',
  'https://www.saashub.com/best-resource-management-software',
  'https://www.saashub.com/best-productivity-software',
  'https://www.saashub.com/best-office-and-productivity-software',
  'https://www.saashub.com/best-group-chat-and-notifications-software',
  'https://www.saashub.com/best-email-software',
  'https://www.saashub.com/best-automation-software',
  'https://www.saashub.com/best-calendar-software',
  'https://www.saashub.com/best-document-management-software',
  'https://www.saashub.com/best-knowledge-management-software',
  'https://www.saashub.com/best-app-launcher-software',
  'https://www.saashub.com/best-goal-setting-and-okrs-software',
  'https://www.saashub.com/best-mind-maps-software',
  'https://www.saashub.com/best-browsing-experience-software',
  'https://www.saashub.com/best-monitoring-tools-software',
  'https://www.saashub.com/best-security-and-privacy-software',
  'https://www.saashub.com/best-log-management-software',
  'https://www.saashub.com/best-cyber-security-software',
  'https://www.saashub.com/best-website-monitoring-software',
  'https://www.saashub.com/best-security-monitoring-software',
  'https://www.saashub.com/best-application-performance-monitoring-software',
  'https://www.saashub.com/best-network-monitoring-software',
  'https://www.saashub.com/best-diagnostics-software-software',
  'https://www.saashub.com/best-load-and-performance-testing-software',
  'https://www.saashub.com/best-server-monitoring-software',
  'https://www.saashub.com/best-cloud-monitoring-software',
  'https://www.saashub.com/best-user-experience-monitoring-software',
  'https://www.saashub.com/best-crm-software',
  'https://www.saashub.com/best-erp-software',
  'https://www.saashub.com/best-help-desk-software',
  'https://www.saashub.com/best-sales-software',
  'https://www.saashub.com/best-customer-support-software',
  'https://www.saashub.com/best-file-manager-software',
  'https://www.saashub.com/best-lead-generation-software',
  'https://www.saashub.com/best-sales-automation-software',
  'https://www.saashub.com/best-contact-management-software',
  'https://www.saashub.com/best-nonprofit-crm-software',
  'https://www.saashub.com/best-real-estate-crm-software',
  'https://www.saashub.com/best-personal-crm-software',
  'https://www.saashub.com/best-customer-engagement-software',
  'https://www.saashub.com/best-marketing-platform-software',
  'https://www.saashub.com/best-email-marketing-software',
  'https://www.saashub.com/best-seo-tools-software',
  'https://www.saashub.com/best-advertising-software',
  'https://www.saashub.com/best-marketing-automation-software',
  'https://www.saashub.com/best-ad-networks-software',
  'https://www.saashub.com/best-content-marketing-software',
  'https://www.saashub.com/best-affiliate-marketing-software',
  'https://www.saashub.com/best-influencer-marketing-software',
  'https://www.saashub.com/best-growth-hacking-software',
  'https://www.saashub.com/best-social-media-management-software',
  'https://www.saashub.com/best-marketing-analytics-software',
  'https://www.saashub.com/best-mobile-app-marketing-software',
  'https://www.saashub.com/best-developer-tools-software',
  'https://www.saashub.com/best-cloud-computing-software',
  'https://www.saashub.com/best-api-tools-software',
  'https://www.saashub.com/best-code-collaboration-software',
  'https://www.saashub.com/best-web-development-tools-software',
  'https://www.saashub.com/best-error-tracking-software',
  'https://www.saashub.com/best-automated-testing-software',
  'https://www.saashub.com/best-continuous-integration-software',
  'https://www.saashub.com/best-text-editors-software',
  'https://www.saashub.com/best-browser-testing-software',
  'https://www.saashub.com/best-mobile-app-builder-software',
  'https://www.saashub.com/best-build-tools-software',
  'https://www.saashub.com/best-configuration-management-software',
  'https://www.saashub.com/best-design-tools-software',
  'https://www.saashub.com/best-graphic-design-software-software',
  'https://www.saashub.com/best-image-editing-software',
  'https://www.saashub.com/best-3d-software',
  'https://www.saashub.com/best-prototyping-software',
  'https://www.saashub.com/best-css-framework-software',
  'https://www.saashub.com/best-website-design-software',
  'https://www.saashub.com/best-animation-software',
  'https://www.saashub.com/best-cad-software',
  'https://www.saashub.com/best-logo-maker-software',
  'https://www.saashub.com/best-typography-software',
  'https://www.saashub.com/best-ui-design-software',
  'https://www.saashub.com/best-video-editing-software',
  'https://www.saashub.com/best-communication-software',
  'https://www.saashub.com/best-social-networks-software',
  'https://www.saashub.com/best-enterprise-communication-software',
  'https://www.saashub.com/best-instant-messaging-software',
  'https://www.saashub.com/best-social-and-communications-software',
  'https://www.saashub.com/best-video-conferencing-software',
  'https://www.saashub.com/best-email-clients-software',
  'https://www.saashub.com/best-voip-software',
  'https://www.saashub.com/best-sms-marketing-software',
  'https://www.saashub.com/best-content-collaboration-software',
  'https://www.saashub.com/best-collaboration-software',
  'https://www.saashub.com/best-document-collaboration-software',
  'https://www.saashub.com/best-community-management-software',
  'https://www.saashub.com/best-finance-software',
  'https://www.saashub.com/best-personal-finance-software',
  'https://www.saashub.com/best-cryptocurrency-wallets-software',
  'https://www.saashub.com/best-tax-preparation-software',
  'https://www.saashub.com/best-insurance-administration-and-management-software',
  'https://www.saashub.com/best-banking-software',
  'https://www.saashub.com/best-budgeting-software',
  'https://www.saashub.com/best-payments-processing-software',
  'https://www.saashub.com/best-financial-reporting-software',
  'https://www.saashub.com/best-financial-risk-management-software',
  'https://www.saashub.com/best-stock-market-software',
  'https://www.saashub.com/best-investment-management-software',
  'https://www.saashub.com/best-forex-software',
  'https://www.saashub.com/best-education-software',
  'https://www.saashub.com/best-lms-software',
  'https://www.saashub.com/best-spaced-repetition-software',
  'https://www.saashub.com/best-online-courses-software',
  'https://www.saashub.com/best-school-management-software',
  'https://www.saashub.com/best-language-learning-software',
  'https://www.saashub.com/best-kids-education-software',
  'https://www.saashub.com/best-research-tools-software',
  'https://www.saashub.com/best-digital-assessments-and-tests-software',
  'https://www.saashub.com/best-careers-software',
  'https://www.saashub.com/best-educational-games-software',
  'https://www.saashub.com/best-hr-software',
  'https://www.saashub.com/best-time-tracking-software',
  'https://www.saashub.com/best-employee-engagement-software',
  'https://www.saashub.com/best-employee-performance-management-software',
  'https://www.saashub.com/best-resume-builder-software',
  'https://www.saashub.com/best-leave-management-software',
  'https://www.saashub.com/best-talent-management-software',
  'https://www.saashub.com/best-employee-onboarding-software',
  'https://www.saashub.com/best-payroll-management-software',
  'https://www.saashub.com/best-workforce-management-software',
  'https://www.saashub.com/best-employee-productivity-software',
];

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * Returns {isError: false, data: []} or {isError: true, error}
 * data schema: {websiteUrl, shUrl, name, desc}
 */
const getToolsList = async (servicesListSelector) => {
  window.scrollTo(0, document.body.scrollHeight);

  try {
    const servicesList = document.querySelector(servicesListSelector);
    const listItems = servicesList.querySelectorAll('li.services-list__item');
    const toReturn = [];
    for (let j = 0; j < listItems.length; j++) {
      const itemEl = listItems[j];
      let websiteUrl = '';
      let shUrl = '';
      let name = '';
      let desc = '';

      const websiteAnchor = itemEl.querySelector('a[title="Visit Website"]');
      const titleAnchor = itemEl.querySelector('h3 > a');
      const descP = itemEl.querySelector('p.tagline[itemprop="description"]');

      if (titleAnchor) {
        name = titleAnchor.innerText;
        shUrl = titleAnchor.getAttribute('href');
        if (shUrl) shUrl = fixShUrl(shUrl);
      }
      if (descP) desc = descP.innerText;

      // If website anchor exists, get url from there
      if (websiteAnchor) {
        websiteUrl = websiteAnchor.getAttribute('href');
      }

      // If not, find all anchors
      else {
        const anchorTags = itemEl.querySelectorAll('a');
        for (let i = 0; i < anchorTags.length; i++) {
          const tag = anchorTags[i];
          const href = tag.href;
          if (!href.includes('saashub.com')) {
            websiteUrl = href;
          }
        }
      }

      if (shUrl) toReturn.push({ websiteUrl, shUrl, name, desc });
    }
    return { isError: false, data: toReturn };
  } catch (error) {
    console.error(error);
    return { isError: true, error: { ...error } };
  }
};

puppeteer.launch({ headless: 'new' }).then(async (browser) => {
  const servicesListSelector = '#main_list > ol';

  for (let i = START_INDEX; i < CATEGORY_URLS.length; i++) {
    const category_url = CATEGORY_URLS[i];
    console.log('Starting category', category_url);
    console.log('Index', i);

    fs.appendFileSync(OUT_FILE, category_url);
    const shPage = await browser.newPage();
    await shPage.goto(category_url);
    await shPage.waitForSelector(servicesListSelector);

    let shouldContinueScraping = true;
    let finalToolsList = [];

    while (shouldContinueScraping) {
      const toolsListRes = await shPage.evaluate(
        getToolsList,
        servicesListSelector
      );

      if (toolsListRes.isError) {
        shouldContinueScraping = false;
        console.log('Error getting tools list');
        return;
      } else {
        const toolsList = toolsListRes.data;
        if (finalToolsList.length === toolsList.length) {
          shouldContinueScraping = false;
        } else {
          const toUpdateList = toolsList.slice(finalToolsList.length);
          toUpdateList.forEach((toolData) => {
            fs.appendFileSync(OUT_FILE, '\n' + JSON.stringify(toolData));
          });

          finalToolsList = toolsList;
          const MAX_TOOLS_LIST = 259;
          if (finalToolsList.length >= MAX_TOOLS_LIST) {
            shouldContinueScraping = false;
          }

          console.log(
            'Index',
            i,
            'Progress',
            finalToolsList.length + ' / ' + MAX_TOOLS_LIST
          );
        }
      }

      // Click next button and wait
      const loadMoreButtonSelector = '#load_more_services_btn';
      if (shouldContinueScraping) {
        // See if button exists
        let loadMoreButtonExists = true;
        try {
          await shPage.waitForSelector(loadMoreButtonSelector);
        } catch {
          loadMoreButtonExists = false;
        }

        if (loadMoreButtonExists) {
          // Click button if it exists and not disabled
          const buttonClickRes = await shPage.evaluate(
            async (loadMoreButtonSelector) => {
              const loadMoreButton = document.querySelector(
                loadMoreButtonSelector
              );
              if (!loadMoreButton || loadMoreButton.disabled)
                return { didClick: false };
              loadMoreButton.click();
              return { didClick: true };
            },
            loadMoreButtonSelector
          );

          if (buttonClickRes.didClick) {
            // Wait until next list item exists
            const nextItemSelector = `#main_list > ol > li:nth-child(${
              finalToolsList.length + 2
            })`;
            try {
              await shPage.waitForSelector(nextItemSelector);
            } catch {
              console.log('Did not find next item');
              shouldContinueScraping = false;
            }
          } else {
            console.log('Button not clicked');
            shouldContinueScraping = false;
          }
        } else {
          console.log('Load more button does not exist');
          shouldContinueScraping = false;
        }
      }

      if (shouldContinueScraping)
        await new Promise((resolve) => setTimeout(resolve, RUN_DELAY));
    }

    console.log('Category done', category_url);
    console.log('Index done', i);
    fs.appendFileSync(OUT_FILE, '\n');

    await shPage.close();
    await new Promise((resolve) => setTimeout(resolve, RUN_DELAY));
  }

  await browser.close();
});
