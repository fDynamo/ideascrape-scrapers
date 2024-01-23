import pandas as pd
import os.path as path
from os import listdir
from calculate_unique_url import calculate_unique_url
from helpers.string_formatters import camel_to_snake_case

dir_path = path.dirname(path.realpath(__file__))
AIFT_OUT_PATH = path.join(dir_path, "..", "scrape_aift", "out")
AIFT_PERIODS_PATH = path.join(AIFT_OUT_PATH, "periods")
AIFT_POSTS_PATH = path.join(AIFT_OUT_PATH, "posts")
MVP_OUT_FOLDER = path.join(dir_path, "out", "mvp")
OUT_FILE = path.join(MVP_OUT_FOLDER, "aift_extract.csv")
UNSCRAPED_OUT = path.join(MVP_OUT_FOLDER, "aift_unscraped.csv")

# Read all from periods
period_files = [
    path.join(AIFT_PERIODS_PATH, f)
    for f in listdir(AIFT_PERIODS_PATH)
    if f.endswith(".csv") and path.isfile(path.join(AIFT_PERIODS_PATH, f))
]

period_df_list = []
for period_file in period_files:
    df: pd.DataFrame = pd.read_csv(period_file)
    df = df.loc[:, ["projectName", "sourceUrl", "postUrl", "countSaves", "starRatings"]]
    period_df_list.append(df)

# Merge dfs
period_df: pd.DataFrame = pd.concat(period_df_list, axis=0)
new_columns = [camel_to_snake_case(col) for col in period_df.columns]
period_df.columns = new_columns
period_df = period_df.rename(columns={"star_ratings": "rating"})
period_df = period_df.drop_duplicates(subset="post_url", keep="last").reset_index(
    drop=True
)

# Save post urls for comparison later
all_post_urls = period_df[["post_url"]]


# Read from posts
post_files = [
    path.join(AIFT_POSTS_PATH, f)
    for f in listdir(AIFT_POSTS_PATH)
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
        ],
    ]
    post_df_list.append(df)

post_df = pd.concat(post_df_list, axis=0)
post_df.columns = ["post_url", "count_ratings", "description", "launch_date_text"]
post_df = post_df.drop_duplicates(subset="post_url", keep="last").reset_index(drop=True)


aift_df = post_df.merge(period_df, how="inner", on="post_url").reset_index(drop=True)


def fix_launch_date(launch_date: str):
    if len(launch_date) > 10:
        non_year_date = launch_date[4:]
        non_year_date = non_year_date.replace("0", "")
        launch_date = launch_date[0:4] + non_year_date
    return launch_date


aift_df["launch_date_text"] = aift_df["launch_date_text"].apply(fix_launch_date)

# Grab date from featured at
aift_df["launch_date"] = pd.to_datetime(aift_df["launch_date_text"], format="mixed")

# Get unique url
aift_df["unique_url"] = aift_df["source_url"].apply(calculate_unique_url)


# Reorder
aift_df = aift_df[
    [
        "post_url",
        "source_url",
        "unique_url",
        "count_saves",
        "count_ratings",
        "rating",
        "project_name",
        "description",
        "launch_date",
    ]
]

aift_df.index.name = "index"

print(aift_df)
print("Columns")
print(aift_df.columns)

aift_df.to_csv(OUT_FILE, encoding="utf-8")

# Find out unscraped urls
unscraped_df = all_post_urls.merge(
    aift_df, left_on="post_url", right_on="post_url", indicator=True, how="left"
)
unscraped_df = unscraped_df[unscraped_df["_merge"] == "left_only"].reset_index(
    drop=True
)[["post_url"]]
unscraped_df.to_csv(UNSCRAPED_OUT, encoding="utf-8")
