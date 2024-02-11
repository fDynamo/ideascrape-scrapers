const csv = require("csv-parser");
const fs = require("fs");

async function readCsvFile(csvfilepath) {
  const results = await new Promise((resolve) => {
    const toReturn = [];
    fs.createReadStream(csvfilepath)
      .pipe(csv())
      .on("data", (data) => toReturn.push(data))
      .on("end", () => {
        resolve(toReturn);
      });
  });

  return results;
}

module.exports = { readCsvFile };
