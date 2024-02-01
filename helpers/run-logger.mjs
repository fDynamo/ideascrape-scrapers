import { createObjectCsvWriter } from "csv-writer";
import { getDateFilename } from "./index.js";
import { join } from "path";

export async function createRunLogger(scriptName, outFolder) {
  const startDate = new Date();
  const scriptStartedStr = startDate.toISOString();
  const scriptStartedFilename = getDateFilename(startDate);

  console.log(scriptName, "[START]", scriptStartedStr);

  const baseFileName = `${scriptName}-${scriptStartedFilename}`;
  const startLogFileName = baseFileName + "-start.csv";
  const startLogFilePath = join(outFolder, startLogFileName);

  const endLogFileName = baseFileName + "-end.csv";
  const endLogFilePath = join(outFolder, endLogFileName);

  const logFileName = baseFileName + "-log.csv";
  const logFilePath = join(outFolder, logFileName);

  // Create CSV writers
  const KEY_VAL_HEADER = [
    { id: "key", title: "key" },
    { id: "val", title: "val" },
  ];

  const startLogCsvWriter = createObjectCsvWriter({
    path: startLogFilePath,
    header: KEY_VAL_HEADER,
  });
  const endLogCsvWriter = createObjectCsvWriter({
    path: endLogFilePath,
    header: KEY_VAL_HEADER,
  });
  const logCsvWriter = createObjectCsvWriter({
    path: logFilePath,
    header: KEY_VAL_HEADER,
  });

  // Write start info
  await startLogCsvWriter.writeRecords([
    {
      key: "startedAt",
      val: scriptStartedStr,
    },
  ]);

  return {
    baseFileName,
    scriptStartedFilename,
    startDate,
    scriptStartedStr,
    startLogCsvWriter,
    addToStartLog: async function (toAdd) {
      const toWrite = objToKeyVal(toAdd);
      await this.startLogCsvWriter.writeRecords(toWrite);
    },
    endLogCsvWriter,
    addToEndLog: async function (toAdd) {
      const toWrite = objToKeyVal(toAdd);
      await this.endLogCsvWriter.writeRecords(toWrite);
    },
    stopRunLogger: async function () {
      const endDate = new Date();
      const endStr = endDate.toISOString();
      console.log(scriptName, "[FINISH]", endStr);
      await this.addToEndLog({ endedAt: endStr });
    },
    logCsvWriter,
    addToLog: async function (toAdd) {
      console.log(scriptName, "[LOG]", toAdd);
      const nowDate = new Date();
      const nowStr = nowDate.toISOString();
      const toWrite = objToKeyVal(toAdd).map((obj) => {
        return { ...obj };
      });
      toWrite.unshift({ key: "date", val: nowStr });
      toWrite.push({ key: "", val: "" });
      await this.logCsvWriter.writeRecords(toWrite);
    },
  };
}

function objToKeyVal(jsonObj) {
  return Object.entries(jsonObj).map((item) => {
    return { key: item[0], val: item[1] };
  });
}
