const evaluateTasks = async (tasksSelector) => {
  const tasksDiv = document.querySelector(tasksSelector);
  const listItems = tasksDiv.querySelectorAll("li.li.m");
  const toReturn = [];
  for (let i = 0; i < listItems.length; i++) {
    const listItem = listItems[i];

    // Get data / basic info
    const dataName = listItem.getAttribute("data-name");
    const dataUrl = listItem.getAttribute("data-url");
    const dataSlug = listItem.getAttribute("data-task_slug");

    const projectName = dataName;
    const sourceUrl = dataUrl;
    const aiftSlug = dataSlug;

    // Title anchor tag
    const titleAnchor = listItem.querySelector("a.ai_link");
    const titleAnchorText = titleAnchor.innerText;
    const titleAnchorUrl = titleAnchor.href;

    const projectName2 = titleAnchorText;
    const titleLinkUrl = titleAnchorUrl;

    // Check if verified
    const listItemClass = listItem.getAttribute("class");
    const isVerified = listItemClass.includes("verified");

    // Get corner icon
    let cornerIconUrl = "";
    const cornerIconEl = listItem.querySelector("span.corner_icon");
    if (cornerIconEl) {
      cornerIconUrl = window
        .getComputedStyle(cornerIconEl)
        .getPropertyValue("background-image");
    }

    // Get price
    let priceText = "";
    const priceSelector = "div.available_starting";
    const priceDiv = listItem.querySelector(priceSelector);
    if (priceDiv) priceText = priceDiv.innerText;

    // Get label
    let labelText = "";
    const labelSelector = "a.task_label";
    const labelEl = document.querySelector(labelSelector);
    if (labelEl) {
      labelText = labelEl.innerText;
    }

    // Get postUrl
    let postUrl = "";
    const statsAnchorSelector = "a.stats";
    const statsAnchor = document.querySelector(statsAnchorSelector);
    if (statsAnchor) {
      postUrl = statsAnchor.href;
    }

    // Get stats
    let starRatings = 0;
    let countSaves = 0;
    let countComments = 0;

    const statsRightSelector = "a > span.stats_right";
    const statsRightDiv = listItem.querySelector(statsRightSelector);
    if (statsRightDiv) {
      const savesSelector = "div.saves";
      const commentsSelector = "div.comments";
      const starsSelector = "span.star";

      const savesEl = statsRightDiv.querySelector(savesSelector);
      if (savesEl) {
        countSaves = parseInt(savesEl.innerText);
      }
      const commentsEl = statsRightDiv.querySelector(commentsSelector);
      if (commentsEl) {
        countComments = parseInt(commentsEl.innerText);
      }

      const starsEl = statsRightDiv.querySelector(starsSelector);
      if (starsEl) {
        const statsText = statsRightDiv.innerText;
        const statsComponents = statsText.split("\n");
        if (statsComponents.length)
          starRatings = parseFloat(statsComponents[statsComponents.length - 1]);
      }
    }

    toReturn.push({
      projectName,
      projectName2,
      aiftSlug,
      sourceUrl,
      titleLinkUrl,
      postUrl,
      isVerified,
      cornerIconUrl,
      labelText,
      priceText,
      starRatings,
      countSaves,
      countComments,
    });
  }
  return toReturn;
};

const evaluatePostPage = async () => {
  // Use case
  const useCaseSelector = "div#use_case";
  let useCase = "";
  const useCaseEl = document.querySelector(useCaseSelector);
  if (useCaseEl) {
    useCase = useCaseEl.innerText;
    useCase = useCase.trim();
  }

  // Description
  const descriptionSelector = "div.col_inner > div.description";
  let chatGptDescription = "";
  const descriptionEl = document.querySelector(descriptionSelector);
  if (descriptionEl) {
    const paragraphsInDescription = descriptionEl.querySelectorAll("p");
    for (let j = 0; j < paragraphsInDescription.length; j++) {
      pEl = paragraphsInDescription[j];
      chatGptDescription += pEl.innerText + " ";
    }
  }

  // Pros and cons
  let prosList = [];
  let consList = [];

  const proDivSelector = "div.pac-info-item-pros";
  const proDivEl = document.querySelector(proDivSelector);
  if (proDivEl) {
    const listItems = proDivEl.querySelectorAll("div");
    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i];
      const val = item.innerText;
      prosList.push(val);
    }
  }

  const conDivSelector = "div.pac-info-item-cons";
  const conDivEl = document.querySelector(conDivSelector);
  if (conDivEl) {
    const listItems = conDivEl.querySelectorAll("div");
    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i];
      const val = item.innerText;
      consList.push(val);
    }
  }

  prosList = JSON.stringify(prosList);
  consList = JSON.stringify(consList);

  // Faq
  let faqList = [];
  const faqInfoSelector = "div.faq-info";
  const faqInfos = document.querySelectorAll(faqInfoSelector);

  for (let i = 0; i < faqInfos.length; i++) {
    const item = faqInfos[i];
    const childDivs = item.querySelectorAll("div");
    if (childDivs.length == 2) {
      const titleDiv = childDivs[0];
      const descriptionDiv = childDivs[1];

      const faqTitle = titleDiv.innerText;
      const faqDescription = descriptionDiv.innerHTML;

      faqList.push({
        faqTitle,
        faqDescription,
      });
    }
  }

  faqList = JSON.stringify(faqList);

  // Info panel
  let firstFeaturedText = "";
  const infoPanelSelector = "div.box.info_panel > div.info_panel_top";
  const infoPanelDiv = document.querySelector(infoPanelSelector);
  if (infoPanelDiv) {
    firstFeaturedText = infoPanelDiv.innerText;
  }

  // Label
  let taskLabel = "";
  const labelSelector = "a.task_label";
  const labelEl = document.querySelector(labelSelector);
  if (labelEl) taskLabel = labelEl.innerText;

  // Top date
  let launchDateText = "";
  const dateSelector = "span.launch_date_top";
  const dateEl = document.querySelector(dateSelector);
  if (dateEl) launchDateText = dateEl.innerText;

  // Bread crumbs
  let breadcrumbsText = "";
  const breadcrumbsSelector = "div.breadcrumbs";
  const breadcrumbsEl = document.querySelector(breadcrumbsSelector);
  if (breadcrumbsEl) {
    breadcrumbsText = breadcrumbsEl.innerText || "";
    breadcrumbsText = breadcrumbsText.trim();
  }

  // Ratings
  let starRatings = 0;
  let countRatings = 0;
  const ratingsSelector = "a.rating_top";
  const ratingsEl = document.querySelector(ratingsSelector);
  if (ratingsEl) {
    const ratingText = ratingsEl.innerText || "";
    if (ratingText) {
      const components = ratingText.trim().split("\n");
      if (components.length == 2) {
        starRatings = parseFloat(components[0]);
        countRatings = components[1];
        countRatings = countRatings.substring(1, countRatings.length - 1);
        countRatings = parseInt(countRatings);
      }
    }
  }

  // Saves
  let countSaves = 0;
  const savesSelector = ".stats > .saves";
  const savesEl = document.querySelector(savesSelector);
  if (savesEl) {
    countSaves = savesEl.innerText;
  }

  // Ranking related data
  const rankingSelector = "div#rank";
  const rankingDiv = document.querySelector(rankingSelector);

  // Ranking variables
  let primaryTask = "";
  const mostPopularAlternative = {};
  let rankingAlternativesText = "";
  let tagList = [];
  let priceTag = "";
  let rankingText = "";

  if (rankingDiv) {
    // Primary task
    const primaryTaskSelector = "span.task_label";
    const primaryTaskEl = rankingDiv.querySelector(primaryTaskSelector);
    if (primaryTaskEl) primaryTask = primaryTaskEl.innerText;

    // Ranking text
    const rankingTextSelector = "a.rank_inner > .bottom";
    const rankingTextEl = rankingDiv.querySelector(rankingTextSelector);
    if (rankingTextEl) {
      rankingText = rankingTextEl.innerText;
    }

    // Tags
    const tagsDivSelector = "div.tags";
    const tagsDiv = rankingDiv.querySelector(tagsDivSelector);

    if (tagsDiv) {
      const tagAnchorList = tagsDiv.getElementsByTagName("a");
      for (let i = 0; i < tagAnchorList.length; i++) {
        const tagEl = tagAnchorList[i];
        const tagText = tagEl.innerText;
        tagList.push(tagText);
      }

      // Price tag
      const priceTagSelector = "span.tag.price";
      const priceTagEl = tagsDiv.querySelector(priceTagSelector);
      if (priceTagEl) priceTag = priceTagEl.innerText;
    }

    // Most popular alternative
    const mpaSelector = "div.pill.nobg > a";
    const mpaEl = rankingDiv.querySelector(mpaSelector);
    if (mpaEl) {
      mostPopularAlternative.postUrl = mpaEl.href;
      mostPopularAlternative.name = mpaEl.innerText;
    }

    // Num alternatives
    const alternativesTextSelector = "a.pill > span.fa-lightbulb.fa";
    const alternativesTextEl = rankingDiv.querySelector(
      alternativesTextSelector
    );
    if (alternativesTextEl) {
      rankingAlternativesText = alternativesTextEl.parentElement.innerText;
    }
  }
  tagList = JSON.stringify(tagList);

  // Alternatives text
  let alternativesCount = 0;
  const alternativesTitleSelector = "h2#alternatives";
  const alternativesTitleEl = document.querySelector(alternativesTitleSelector);
  if (alternativesTitleEl) {
    alternativesCount = parseInt(alternativesTitleEl.innerText.split(" ")[0]);
  }

  // People also searched
  let alsoSearchedList = [];
  const alsoSearchedSelector = "div.also_searched_inner";
  const alsoSearchedEl = document.querySelector(alsoSearchedSelector);

  if (alsoSearchedEl) {
    alsoSearchedList = alsoSearchedEl.innerText.split("\n");
  }

  alsoSearchedList = JSON.stringify(alsoSearchedList);

  // Comments
  let countComments = 0;
  const countCommentsSelector = "div#user_comments_title > span.ratings_count";
  const countCommentsEl = document.querySelector(countCommentsSelector);
  if (countCommentsEl) {
    countComments = countCommentsEl.innerText;
    countComments = parseInt(
      countComments.substring(1, countComments.length - 1)
    );
  }

  return {
    productInfo: {
      useCase,
      chatGptDescription,
      faqList,
      firstFeaturedText,
      launchDateText,
      breadcrumbsText,
      prosList,
      consList,
      priceTag,
      primaryTask,
      rankingText,
    },
    tags: {
      taskLabel,
      tagList,
    },
    ratings: {
      starRatings,
      countRatings,
      countComments,
      countSaves,
    },
    alternatives: {
      alternativesCount,
      mostPopularAlternative,
      rankingAlternativesText,
      alsoSearchedList,
    },
  };
};

module.exports = {
  evaluateTasks,
  evaluatePostPage,
};
