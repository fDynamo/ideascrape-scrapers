const axios = require("axios");

const OPERATION_NAME = "HomePage";
const MAIN_QUERY = `
query HomePage($cursor: String, $kind: HomefeedKindEnum!) {
  homefeed(after: $cursor, kind: $kind) {
    kind
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      ...HomefeedEdgeFragment
    }
  }
}

fragment HomefeedEdgeFragment on HomefeedEdgeCustom {
  node {
    date
    items {
      ... on Post {
        ...PostInfo
        topics(first: 4) {
          edges {
            node {
              id
              slug
              name
            }
          }
        }
        primaryLink {
          id
          url
        }
        ...ProductInfo
        ...MetaTags
        __typename
      }
    }
  }
}

fragment PostInfo on Post {
  pricingType
  createdAt
  featuredAt
  slug
  name
  description
  id
  votesCount
  commentsCount
  tagline
  dailyRank
  links {
    id
    redirectPath
    storeName
    websiteName
    devices
    url
  }
  user {
    ...PostAuthor
  }
}

fragment PostAuthor on User {
  id
  name
  username
  url
  links {
    url
  }
  followersCount
}

fragment ProductInfo on Post {
  product {
    description
    name
    slug
    tagline
    postsCount
    reviewsCount
    reviewersCount
    reviewsRating
    followersCount
    isNoLongerOnline
    websiteUrl
    websiteDomain
    isClaimed
    cleanUrl
    firstPost {
      id
      createdAt
    }
  }
}

fragment MetaTags on SEOInterface {
  id
  meta {
    canonicalUrl
    creator
    description
    title
    type
    author
    authorUrl
  }
}
`;

async function queryPH(cursor) {
  const variables = {
    kind: "ALL",
    cursor: "" + cursor,
  };
  const res = await axios.post("https://www.producthunt.com/frontend/graphql", {
    operationName: OPERATION_NAME,
    variables,
    query: MAIN_QUERY,
  });

  return res.data;
}

module.exports = {
  queryPH,
};
