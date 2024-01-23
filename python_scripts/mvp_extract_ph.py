import pandas as pd
import os.path as path
from os import listdir
from calculate_unique_url import calculate_unique_url
from helpers.string_formatters import camel_to_snake_case

dir_path = path.dirname(path.realpath(__file__))
PH_OUT_PATH = path.join(dir_path, "..", "scrape_ph", "out")
MVP_OUT_FOLDER = path.join(dir_path, "out", "mvp")
OUT_FILE = path.join(MVP_OUT_FOLDER, "ph_extract.csv")

# Read all from all files
all_ph_files = listdir(PH_OUT_PATH)
all_ph_files.sort()
ph_files = [
    path.join(PH_OUT_PATH, f)
    for f in all_ph_files
    if f.endswith(".csv") and path.isfile(path.join(PH_OUT_PATH, f))
]

df_list = []
for filepath in ph_files:
    df: pd.DataFrame = pd.read_csv(filepath)
    df = df.loc[
        :,
        [
            "name",
            "description",
            "product.websiteUrl",
            "product.firstPost.createdAt",
            "product.reviewsCount",
            "product.reviewsRating",
            "product.followersCount",
            "meta.canonicalUrl",
        ],
    ]
    df_list.append(df)

# Merge dfs
ph_df: pd.DataFrame = pd.concat(df_list, axis=0)
ph_df.columns = [
    "product_name",
    "product_description",
    "product_url",
    "created_at",
    "count_review",
    "rating",
    "count_follower",
    "ph_url",
]

# Drop all without urls
ph_df = ph_df[~ph_df["product_url"].isna()]

# Drop all duplicates
ph_df = ph_df.drop_duplicates(subset="product_url", keep="last")

# Get unique urls
ph_df["unique_url"] = ph_df["product_url"].apply(calculate_unique_url)

# Convert to datetime
ph_df["created_at"] = pd.to_datetime(ph_df["created_at"])

# Sort columns
ph_df = ph_df[
    [
        "unique_url",
        "product_name",
        "product_description",
        "product_url",
        "count_follower",
        "count_review",
        "rating",
        "ph_url",
        "created_at",
    ]
]


ph_df = ph_df.sort_values(by=["created_at"]).reset_index(drop=True)
ph_df.index.name = "id"

print(ph_df)
print("Columns")
print(ph_df.columns)

ph_df.to_csv(OUT_FILE, encoding="utf-8")
