const timeoutPromise = (waitInMs) => {
  return new Promise((resolve) => setTimeout(resolve, waitInMs));
};
const getArgs = () => {
  const fullArgs = process.argv;
  if (fullArgs.length < 2) return [null];

  const fullLength = 4;
  const args = fullArgs.slice(2);
  const toReturn = [];
  for (let i = 0; i < fullLength; i++) {
    if (i >= args.length) {
      toReturn.push(null);
      continue;
    }

    const arg = args[i];
    if (!arg) toReturn.push(null);
    else {
      toReturn.push(arg);
    }
  }

  return toReturn;
};

const getDateFilename = (date) => {
  return date.toISOString().replace(/:/g, "_");
};

const convertObjKeysToHeader = (obj) => {
  const header = Object.keys(obj).map((headerTitle) => {
    return { id: headerTitle, title: headerTitle };
  });
  return header;
};

const getPercentageString = (currIndex, startIndex, lastIndex) => {
  const normalizedIndex = currIndex - startIndex;
  const normalizedLastIndex = lastIndex - startIndex;
  const doneFraction = normalizedIndex / normalizedLastIndex;
  const donePercentage = doneFraction * 100;
  const donePercentageString = donePercentage.toFixed(2) + "%";
  return donePercentageString;
};

module.exports = {
  timeoutPromise,
  getArgs,
  getDateFilename,
  convertObjKeysToHeader,
  getPercentageString,
};
