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

module.exports = {
  timeoutPromise,
  getArgs,
  getDateFilename,
};
