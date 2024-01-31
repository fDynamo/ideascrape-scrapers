const evaluateSimilarWebPage = async (tasksSelector) => {
  let urlTitle = "";
  let dataDate = "";
  const overviewContentSelector =
    "div.wa-overview__row div.wa-overview__column--content";
  const overviewContentEl = document.querySelector(overviewContentSelector);
  if (overviewContentSelector) {
    const dateSelector = "p.wa-overview__text--date";
    const dateEl = overviewContentEl.querySelector(dateSelector);
    if (dateEl) dataDate = dateEl.innerText;

    const titleSelector = "p.wa-overview__title";
    const titleEl = overviewContentEl.querySelector(titleSelector);
    if (titleEl) urlTitle = titleEl.innerText;
  } else {
    return { notFound: true };
  }

  // Company info
  let companyInfoList = [];
  const companyInfoListSelector =
    "div.wa-overview__company dl.app-company-info__list";
  const companyInfoListEl = document.querySelector(companyInfoListSelector);
  if (companyInfoListEl) {
    companyInfoList = companyInfoListEl.innerText.split("\n");
  }

  // Get ranking
  let rankGlobal = "";
  let rankGlobalChange = "";

  let rankCountry = "";
  let rankCountryChange = "";
  let rankCountryName = "";

  let rankCategory = "";
  let rankCategoryChange = "";
  let rankCategoryName = "";

  const overviewRankingSelector = "div.wa-overview__column--ranking";
  const overviewRankingEl = document.querySelector(overviewRankingSelector);
  if (overviewRankingEl) {
    const getRankingInfo = (containerSelector) => {
      // Get rankGlobal
      const containerEl = overviewRankingEl.querySelector(containerSelector);
      if (containerEl) {
        // Get value
        let value = "";
        const valSelector = "p.wa-rank-list__value";
        const valEl = containerEl.querySelector(valSelector);
        if (valEl) {
          value = valEl.innerText;
        }

        // Get change
        let change = "";
        const negChangeSelector = "span.app-parameter-change--down";
        const negChangeEl = containerEl.querySelector(negChangeSelector);
        if (negChangeEl) {
          change = "-" + negChangeEl.innerText;
        } else {
          const posChangeSelector = "span.app-parameter-change--up";
          const posChangeEl = containerEl.querySelector(posChangeSelector);
          if (posChangeEl) {
            change = "+" + posChangeEl.innerText;
          }
        }

        // Get info
        let info = "";
        const infoSelector = "div.wa-rank-list__info";
        const infoEl = containerEl.querySelector(infoSelector);
        if (infoEl) {
          info = infoEl.innerText.replace("\n", " ");
        }

        return [value, change, info];
      }
    };

    const rankGlobalRes = getRankingInfo("div.wa-rank-list__item--global");
    rankGlobal = rankGlobalRes[0];
    rankGlobalChange = rankGlobalRes[1];

    const rankCountryRes = getRankingInfo("div.wa-rank-list__item--country");
    rankCountry = rankCountryRes[0];
    rankCountryChange = rankCountryRes[1];
    rankCountryName = rankCountryRes[2];

    const rankCategoryRes = getRankingInfo("div.wa-rank-list__item--category");
    rankCategory = rankCategoryRes[0];
    rankCategoryChange = rankCategoryRes[1];
    rankCategoryName = rankCategoryRes[2];
  }

  // Get traffic and engagement
  const engagementListSelector = "div.engagement-list";
  const engagementListEls = document.querySelectorAll(engagementListSelector);

  const processEngagementList = (engagementListEl) => {
    const itemSelector = "div.engagement-list__item";
    const items = engagementListEl.querySelectorAll(itemSelector);

    const toReturn = {};
    items.forEach((itemEl) => {
      let itemName = "";
      const itemNameSelector = "p.engagement-list__item-name";
      const itemNameEl = itemEl.querySelector(itemNameSelector);
      if (itemNameEl) {
        itemName = itemNameEl.getAttribute("data-test");
      }

      let itemVal = "";
      const itemValSelector = "p.engagement-list__item-value";
      const itemValEl = itemEl.querySelector(itemValSelector);
      if (itemValEl) {
        const negChangeSelector = "span.app-parameter-change--down";
        const negChangeEl = itemValEl.querySelector(negChangeSelector);
        if (negChangeEl) {
          itemVal = "-" + itemValEl.innerText;
        } else {
          const posChangeSelector = "span.app-parameter-change--up";
          const posChangeEl = itemValEl.querySelector(posChangeSelector);
          if (posChangeEl) {
            itemVal = "+" + itemValEl.innerText;
          } else {
            itemVal = itemValEl.innerText;
          }
        }
      }
      toReturn[itemName] = itemVal;
    });

    return toReturn;
  };

  let engagementInfo = {};
  engagementListEls.forEach((el) => {
    const res = processEngagementList(el);
    engagementInfo = { ...engagementInfo, ...res };
  });

  const totalVisits = engagementInfo["total-visits"] || "";
  delete engagementInfo["total-visits"];

  const bounceRate = engagementInfo["bounce-rate"] || "";
  delete engagementInfo["bounce-rate"];

  const pagesPerVisit = engagementInfo["pages-per-visit"] || "";
  delete engagementInfo["pages-per-visit"];

  const avgVisitDuration = engagementInfo["avg-visit-duration"] || "";
  delete engagementInfo["avg-visit-duration"];

  // Get country data
  const countriesData = [];
  const geographyChartEl = document.querySelector(
    "div.wa-geography__chart-legend"
  );
  if (geographyChartEl) {
    const countryEls = geographyChartEl.querySelectorAll(
      "div.wa-geography__country-info"
    );
    countryEls.forEach((el) => {
      let countryName = "";
      const nameEl = el.querySelector(".wa-geography__country-name");
      if (nameEl) {
        countryName = nameEl.innerText;
      }

      let trafficPercentage = "";
      let trafficChange = "";
      const trafficEl = el.querySelector("div.wa-geography__country-traffic");
      if (trafficEl) {
        const trafficValueEl = trafficEl.querySelector(
          "span.wa-geography__country-traffic-value"
        );
        trafficPercentage = trafficValueEl.innerText;

        const negChangeEl = trafficEl.querySelector(
          "span.app-parameter-change--down"
        );
        if (negChangeEl) {
          trafficChange = "-" + negChangeEl.innerText;
        } else {
          const posChangeEl = trafficEl.querySelector(
            "span.app-parameter-change--up"
          );
          if (posChangeEl) {
            trafficChange = "+" + posChangeEl.innerText;
          }
        }
      }

      const toAdd = {
        countryName,
        trafficPercentage,
        trafficChange,
      };

      countriesData.push(toAdd);
    });
  }

  const toReturn = {
    urlTitle,
    dataDate,
    companyInfoList,
    rankGlobal,
    rankGlobalChange,
    rankCountry,
    rankCountryChange,
    rankCountryName,
    rankCategory,
    rankCategoryChange,
    rankCategoryName,
    totalVisits,
    bounceRate,
    pagesPerVisit,
    avgVisitDuration,
    otherEngagmentInfo: engagementInfo,
    countriesData,
  };
  return toReturn;
};

module.exports = {
  evaluateSimilarWebPage,
};
