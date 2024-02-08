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
      node {
        date
        items {
          ... on Post {
            product {
              websiteUrl
              structuredData
              followersCount
              url
            }
          }
        }
      }
    }
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
