const evaluateGenericPage = async () => {
  const titleEl = document.querySelector("head title");
  let pageTitle = "";
  if (titleEl) {
    pageTitle = titleEl.innerText;
  }

  const linkElList = document.querySelectorAll("head link");
  let canonicalUrl = "";
  let faviconUrl = "";
  linkElList.forEach((linkEl) => {
    const rel = linkEl.getAttribute("rel");
    if (rel == "canonical") {
      canonicalUrl = linkEl.getAttribute("href");
    }

    if (rel == "shortcut icon" || rel == "icon" || rel == "icon shortcut") {
      faviconUrl = linkEl.getAttribute("href");
    }
  });

  const metaElList = document.querySelectorAll("head meta");
  let pageDescription = "";
  let contentLanguage = "";
  let contentType = "";
  let ogUrl = "";
  let ogLocale = "";
  const twitterMetaTags = [];
  const ogMetaTags = [];
  const otherMetaTags = [];
  metaElList.forEach((metaEl) => {
    const metaName = metaEl.getAttribute("name");
    const metaProperty = metaEl.getAttribute("property");
    const metaContent = metaEl.getAttribute("content");
    const metaHttpEquiv = metaEl.getAttribute("http-equiv");

    const metaInfo = {
      metaName,
      metaProperty,
      metaContent,
      metaHttpEquiv,
    };

    if (metaName == "description") {
      pageDescription = metaContent;
      return;
    }

    if (metaHttpEquiv == "Content-Language") {
      contentLanguage = metaContent;
      return;
    }

    if (metaHttpEquiv == "Content-Type") {
      contentType = metaContent;
      return;
    }

    if (metaProperty && metaProperty.startsWith("og:")) {
      if (metaProperty.includes("locale")) {
        ogLocale = metaContent;
      }

      if (metaProperty.includes("url")) {
        ogUrl = metaContent;
      }

      ogMetaTags.push(metaInfo);
      return;
    }

    if (metaName && metaName.startsWith("twitter:")) {
      twitterMetaTags.push(metaInfo);
      return;
    }

    otherMetaTags.push(metaInfo);
  });

  return {
    pageTitle,
    canonicalUrl,
    pageDescription,
    contentLanguage,
    contentType,
    ogUrl,
    ogLocale,
    twitterMetaTags,
    ogMetaTags,
    otherMetaTags,
    faviconUrl,
  };
};

module.exports = {
  evaluateGenericPage,
};
