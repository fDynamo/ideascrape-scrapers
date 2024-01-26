const dotenv = require("dotenv");
const { existsSync, mkdirSync } = require("node:fs");
dotenv.config();

function getMasterOutFolder() {
  return process.env.MASTER_OUT_FOLDER;
}

function ensureFoldersExist(folderpaths) {
  folderpaths.forEach((folderpath) => {
    if (!existsSync(folderpath)) {
      mkdirSync(folderpath);
    }
  });
}

module.exports = {
  getMasterOutFolder,
  ensureFoldersExist,
};
