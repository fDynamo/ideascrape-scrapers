const timeoutPromise = (waitInMs) => {
  return new Promise((resolve) => setTimeout(resolve, waitInMs));
};
const getArgs = () => {
  const fullArgs = process.argv;
  if (fullArgs.length < 2) return [null];

  const args = fullArgs.slice(2);
  const toReturn = [];
  for (let i = 0; i < args.length; i++) {
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
