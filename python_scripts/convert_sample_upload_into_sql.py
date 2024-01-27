import os.path as path
import csv
from custom_helpers.is_type import is_float
from custom_helpers.get_paths import get_out_folder

MVP_OUT_FOLDER = get_out_folder("mvp")
UPLOAD_OUT_FOLDER = get_out_folder("mvp_to_upload")

SEARCH_MAIN_FILE = path.join(UPLOAD_OUT_FOLDER, "search_main.csv")
SOURCE_PH_FILE = path.join(UPLOAD_OUT_FOLDER, "source_ph.csv")
SOURCE_AIFT_FILE = path.join(UPLOAD_OUT_FOLDER, "source_aift.csv")
SQL_COMMANDS_FILE = path.join(UPLOAD_OUT_FOLDER, "seed.sql")


def process_value(value):
    if not value:
        return "NULL"
    elif isinstance(value, str):
        if value.isdigit() or is_float(value):
            return value
        if value.startswith("["):
            value = value.replace(" ", "")
        value = value.replace("'", "''")
        value = "'" + value + "'"
        return value

    return "NULL"


to_write = []


AIFT_QUERY = 'INSERT INTO "source_aift" (count_save, count_rating, rating, aift_url, product_listed_at) VALUES ({}, {}, {}, {}, {});'

with open(SOURCE_AIFT_FILE, "r", encoding="utf-8") as csvfile:
    reader = csv.reader(csvfile)
    next(reader)
    for row in reader:
        to_add = [process_value(val) for val in row]
        query_to_add = AIFT_QUERY.format(*to_add[1:])
        to_write.append(query_to_add)

PH_QUERY = 'INSERT INTO "source_ph" (count_follower, count_review, rating, ph_url, product_listed_at) VALUES ({}, {}, {}, {}, {});'

with open(SOURCE_PH_FILE, "r", encoding="utf-8") as csvfile:
    reader = csv.reader(csvfile)
    next(reader)
    for row in reader:
        to_add = [process_value(val) for val in row]
        query_to_add = PH_QUERY.format(*to_add[1:])
        to_write.append(query_to_add)

SEARCH_MAIN_QUERY = 'INSERT INTO "search_main" (product_name, product_description, product_url, product_description_embedding, ph_id, aift_id) VALUES ({}, {}, {}, {}, {}, {});'
with open(SEARCH_MAIN_FILE, "r", encoding="utf-8") as csvfile:
    reader = csv.reader(csvfile)
    next(reader)
    for row in reader:
        to_add = [process_value(val) for val in row]
        query_to_add = SEARCH_MAIN_QUERY.format(*to_add[1:])
        to_write.append(query_to_add)
with open(SQL_COMMANDS_FILE, "w", encoding="utf-8") as outfile:
    outfile.write("\n".join(to_write))
