from dotenv import load_dotenv
from os import environ
from os.path import join
import json

load_dotenv()


def get_out_folder(key: str):
    master_root = environ.get("MASTER_OUT_FOLDER")
    directory_structure_filepath = join(master_root, "directory-structure.json")
    new_folder_path = ""
    with open(directory_structure_filepath, "r", encoding="utf-8") as file:
        directory_structure_json = json.load(file)
        new_folder_path = directory_structure_json[key]

    return join(master_root, new_folder_path)
