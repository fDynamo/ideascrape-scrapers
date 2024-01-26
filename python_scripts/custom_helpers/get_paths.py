from dotenv import load_dotenv
from os import environ, mkdir
from os.path import isdir

load_dotenv()


def get_master_out_folder():
    return environ.get("MASTER_OUT_FOLDER")


def ensure_folders_exist(folderpaths: list[str]):
    for folderpath in folderpaths:
        if not isdir(folderpath):
            mkdir(folderpath)
