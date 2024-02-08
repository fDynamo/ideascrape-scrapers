import { createObjectCsvWriter } from "csv-writer";
import { getDateFilename } from "./index.js";
import { join } from "path";

export async function createRunLogger(scriptName, dataHeaders, outFolder) {
  const startDate = new Date();
  const scriptStartedStr = startDate.toISOString();
  const scriptStartedFilename = getDateFilename(startDate);

  console.log(scriptName, "[START]", scriptStartedStr);

  const baseFileName = `${scriptName}-${scriptStartedFilename}`;
  const startLogFileName = baseFileName + "-start.csv";
  const startLogFilePath = join(outFolder, startLogFileName);

  const endLogFileName = baseFileName + "-end.csv";
  const endLogFilePath = join(outFolder, endLogFileName);

  const actionLogFileName = baseFileName + "-action-log.csv";
  const actionLogFilePath = join(outFolder, actionLogFileName);

  const errorLogFileName = baseFileName + "-error.csv";
  const errorLogFilePath = join(outFolder, errorLogFileName);

  const failedLogFileName = baseFileName + "-failed.csv";
  const failedLogFilePath = join(outFolder, failedLogFileName);

  const dataFileName = baseFileName + "-data.csv";
  const dataFilePath = join(outFolder, dataFileName);

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
  const actionLogCsvWriter = createObjectCsvWriter({
    path: actionLogFilePath,
    header: KEY_VAL_HEADER,
  });
  const errorLogCsvWriter = createObjectCsvWriter({
    path: errorLogFilePath,
    header: KEY_VAL_HEADER,
  });
  const failedLogCsvWriter = createObjectCsvWriter({
    path: failedLogFilePath,
    header: KEY_VAL_HEADER,
  });

  const formattedHeaders = dataHeaders.map((headerName) => ({
    id: headerName,
    title: headerName,
  }));
  const dataCsvWriter = createObjectCsvWriter({
    path: dataFilePath,
    header: formattedHeaders,
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
      const durationM =
        (endDate.getTime() - this.startDate.getTime()) / (1000 * 60);
      const durationStr = durationM.toFixed(2) + " minutes";
      console.log(scriptName, "[FINISH]", endStr, durationStr);
      await this.addToEndLog({ endedAt: endStr, duration: durationStr });
    },
    actionLogCsvWriter,
    addToActionLog: async function (toAdd) {
      console.log(scriptName, "[LOG]", toAdd);
      const nowDate = new Date();
      const nowStr = nowDate.toISOString();
      const toWrite = objToKeyVal(toAdd).map((obj) => {
        return { ...obj };
      });
      toWrite.unshift({ key: "date", val: nowStr });
      toWrite.push({ key: "", val: "" });
      await this.actionLogCsvWriter.writeRecords(toWrite);
    },
    errorLogCsvWriter,
    addToErrorLog: async function (toAdd) {
      console.log(scriptName, "[ERROR]", toAdd);
      const nowDate = new Date();
      const nowStr = nowDate.toISOString();
      const toWrite = objToKeyVal(toAdd).map((obj) => {
        return { ...obj };
      });
      toWrite.unshift({ key: "date", val: nowStr });
      toWrite.push({ key: "", val: "" });
      await this.errorLogCsvWriter.writeRecords(toWrite);
    },
    failedLogCsvWriter,
    addToFailedLog: async function (toAdd) {
      console.log(scriptName, "[FAILED]", toAdd);
      const toWrite = objToKeyVal(toAdd).map((obj) => {
        return { ...obj };
      });
      toWrite.push({ key: "", val: "" });
      await this.failedLogCsvWriter.writeRecords(toWrite);
    },
    dataCsvWriter,
    addToData: async function (toAdd) {
      console.log(scriptName, "[WRITING]", "size", toAdd.length);
      console.log(scriptName, "[WRITING]", "sample", toAdd[0]);
      await this.dataCsvWriter.writeRecords(toAdd);
    },
  };
}

function objToKeyVal(jsonObj) {
  return Object.entries(jsonObj).map((item) => {
    return { key: item[0], val: item[1] };
  });
}
