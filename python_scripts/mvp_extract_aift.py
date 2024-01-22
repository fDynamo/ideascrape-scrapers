import pandas as pd
import os.path as path
from os import listdir
from calculate_unique_url import calculate_unique_url

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
period_df = period_df.rename(columns={"starRatings": "rating"})
period_df = period_df.drop_duplicates(subset="postUrl", keep="last").reset_index(
    drop=True
)

# Save post urls for comparison later
all_post_urls = period_df[["postUrl"]]


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
post_df.columns = ["postUrl", "countRatings", "description", "launchDateText"]
post_df = post_df.drop_duplicates(subset="postUrl", keep="last").reset_index(drop=True)


aift_df = post_df.merge(period_df, how="inner", on="postUrl").reset_index(drop=True)


def fix_launch_date(launch_date: str):
    if len(launch_date) > 10:
        non_year_date = launch_date[4:]
        non_year_date = non_year_date.replace("0", "")
        launch_date = launch_date[0:4] + non_year_date
    return launch_date


aift_df["launchDateText"] = aift_df["launchDateText"].apply(fix_launch_date)

# Grab date from featured at
aift_df["launchDate"] = pd.to_datetime(aift_df["launchDateText"], format="mixed")

# Get unique url
aift_df["uniqueUrl"] = aift_df["sourceUrl"].apply(calculate_unique_url)


# Reorder
aift_df = aift_df[
    [
        "postUrl",
        "sourceUrl",
        "uniqueUrl",
        "countSaves",
        "countRatings",
        "rating",
        "projectName",
        "description",
        "launchDate",
    ]
]
aift_df.index.name = "index"
print(aift_df)
print("Columns")
print(aift_df.columns)

aift_df.to_csv(OUT_FILE, encoding="utf-8")

# Find out unscraped urls
unscraped_df = all_post_urls.merge(aift_df, on="postUrl", indicator=True, how="left")
unscraped_df = unscraped_df[unscraped_df["_merge"] == "left_only"].reset_index(
    drop=True
)[["postUrl"]]
unscraped_df.to_csv(UNSCRAPED_OUT, encoding="utf-8")
