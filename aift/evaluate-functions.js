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
    const postUrl = titleAnchorUrl;

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

module.exports = {
  evaluateTasks,
};
