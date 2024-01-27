import pandas as pd
import os.path as path
from os import listdir
from custom_helpers.url_formatters import clean_url
from custom_helpers.string_formatters import camel_to_snake_case
from custom_helpers.filter_urls import is_url_valid
from custom_helpers.string_formatters import clean_text
from custom_helpers.get_paths import get_master_out_folder, ensure_folders_exist


AIFT_OUT_PATH = path.join(get_master_out_folder(), "aift")
AIFT_PERIODS_PATH = path.join(AIFT_OUT_PATH, "periods")
AIFT_POSTS_PATH = path.join(AIFT_OUT_PATH, "posts")
OUT_FOLDER = path.join(get_master_out_folder(), "extracts")
ensure_folders_exist([OUT_FOLDER])

OUT_FILE = path.join(OUT_FOLDER, "aift_extract.csv")
UNSCRAPED_OUT = path.join(OUT_FOLDER, "aift_unscraped.csv")

# Read all from periods
all_period_files = listdir(AIFT_PERIODS_PATH)
all_period_files.sort()

period_files = [
    path.join(AIFT_PERIODS_PATH, f)
    for f in all_period_files
    if f.endswith(".csv") and path.isfile(path.join(AIFT_PERIODS_PATH, f))
]

period_df_list = []
for period_file in period_files:
    df: pd.DataFrame = pd.read_csv(period_file)
    df = df.loc[:, ["projectName", "sourceUrl", "postUrl", "countSaves"]]
    period_df_list.append(df)

# Merge dfs
period_df: pd.DataFrame = pd.concat(period_df_list, axis=0)
new_columns = [camel_to_snake_case(col) for col in period_df.columns]
period_df.columns = new_columns
period_df = period_df.drop_duplicates(subset="post_url", keep="last").reset_index(
    drop=True
)

# Format url
period_df["source_url"] = period_df["source_url"].apply(clean_url)
period_df = period_df.drop_duplicates(subset="source_url", keep="last").reset_index(
    drop=True
)

# Save post urls for comparison later
all_post_urls = period_df[["post_url"]]


# Read from posts
all_post_files = listdir(AIFT_POSTS_PATH)
all_post_files.sort()
post_files = [
    path.join(AIFT_POSTS_PATH, f)
    for f in all_post_files
    if f.endswith(".csv") and path.isfile(path.join(AIFT_POSTS_PATH, f))
]

post_df_list = []
for post_file in post_files:
    df: pd.DataFrame = pd.read_csv(post_file)
    df = df.loc[
        :,
        [
            "_reqMeta.postUrl",
            "ratings.countRatings",
            "productInfo.chatGptDescription",
            "productInfo.launchDateText",
            "ratings.starRatings",
        ],
    ]
    post_df_list.append(df)

post_df = pd.concat(post_df_list, axis=0)
post_df.columns = [
    "post_url",
    "count_ratings",
    "description",
    "launch_date_text",
    "rating",
]
post_df = post_df.drop_duplicates(subset="post_url", keep="last").reset_index(drop=True)


# Merge dfs
aift_df = post_df.merge(period_df, how="inner", on="post_url").reset_index(drop=True)


def fix_launch_date(launch_date: str):
    if len(launch_date) > 10:
        non_year_date = launch_date[4:]
        non_year_date = non_year_date.replace("0", "")
        launch_date = launch_date[0:4] + non_year_date
    return launch_date


aift_df["launch_date_text"] = aift_df["launch_date_text"].apply(fix_launch_date)

# Grab date from featured at
aift_df["launch_date"] = pd.to_datetime(aift_df["launch_date_text"], utc=True)


# Find out unscraped urls
unscraped_df = all_post_urls.merge(
    aift_df, left_on="post_url", right_on="post_url", indicator=True, how="left"
)
unscraped_df = unscraped_df[unscraped_df["_merge"] == "left_only"].reset_index(
    drop=True
)[["post_url"]]
unscraped_df.to_csv(UNSCRAPED_OUT, encoding="utf-8")


# Filter urls
aift_df["is_valid"] = aift_df["source_url"].apply(is_url_valid)
aift_df = aift_df[aift_df["is_valid"] == True]

# Format description
aift_df["description"] = aift_df["description"].apply(clean_text)

# Reorder
aift_df = aift_df[
    [
        "project_name",
        "description",
        "source_url",
        "count_saves",
        "count_ratings",
        "rating",
        "post_url",
        "launch_date",
    ]
]
aift_df.columns = [
    "product_name",
    "product_description",
    "product_url",
    "count_save",
    "count_rating",
    "rating",
    "aift_url",
    "product_listed_at",
]

aift_df = aift_df.sort_values(by=["product_listed_at"]).reset_index(drop=True)
aift_df.index.name = "id"


print(aift_df)
print("Columns")
print(aift_df.columns)

aift_df.to_csv(OUT_FILE, encoding="utf-8")
