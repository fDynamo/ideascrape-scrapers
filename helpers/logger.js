const { getDateFilename } = require("./index");
const { join } = require("node:path");
const { writeFileSync } = require("node:fs");

function logStartScrape(outFolder, startDate, contents) {
  if (!contents) contents = {};

  const scriptStartedStr = startDate.toISOString();
  const scriptStartedFilename = getDateFilename(startDate);

  const logStartFileName = scriptStartedFilename + "-start.txt";
  const logStartFilePath = join(outFolder, logStartFileName);
  const logFileStartContents = {
    startedAt: scriptStartedStr,
    ...contents,
  };
  writeFileSync(logStartFilePath, JSON.stringify(logFileStartContents));

  return { scriptStartedStr, scriptStartedFilename };
}

function logEndScrape(outFolder, startDate, contents) {
  if (!contents) contents = {};

  const scriptEndedDate = new Date();
  const scriptEndedStr = scriptEndedDate.toISOString();
  const runTimeS = (scriptEndedDate.getTime() - startDate.getTime()) / 1000;

  contents.endedAt = scriptEndedStr;
  contents.runTimeS = runTimeS;

  const scriptStartedFilename = getDateFilename(startDate);
  const logEndFileName = scriptStartedFilename + "-end.txt";
  const logEndFilePath = join(outFolder, logEndFileName);
  writeFileSync(logEndFilePath, JSON.stringify(contents));
}

module.exports = {
  logStartScrape,
  logEndScrape,
};
