import pandas as pd
import os.path as path
from os import listdir
from custom_helpers.url_formatters import clean_url
from custom_helpers.string_formatters import clean_text
from custom_helpers.filter_urls import is_url_valid
from custom_helpers.get_paths import get_master_out_folder, ensure_folders_exist

PH_OUT_PATH = path.join(get_master_out_folder(), "ph")
MVP_OUT_FOLDER = path.join(get_master_out_folder(), "mvp")
ensure_folders_exist([MVP_OUT_FOLDER])
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
    "product_listed_at",
    "count_review",
    "rating",
    "count_follower",
    "ph_url",
]

# Drop all without urls
ph_df = ph_df[~ph_df["product_url"].isna()]


# Format url
ph_df["product_url"] = ph_df["product_url"].apply(clean_url)
ph_df = ph_df.drop_duplicates(subset="product_url", keep="last")

# Convert to datetime
ph_df["product_listed_at"] = pd.to_datetime(ph_df["product_listed_at"], utc=True)

# Filter urls
ph_df["is_valid"] = ph_df["product_url"].apply(is_url_valid)
ph_df = ph_df[ph_df["is_valid"] == True]

# Clean description
ph_df["product_description"] = ph_df["product_description"].apply(clean_text)

# Cast to ints
ph_df["count_follower"] = ph_df["count_follower"].astype(int)
ph_df["count_review"] = ph_df["count_review"].astype(int)

# Sort columns
ph_df = ph_df[
    [
        "product_name",
        "product_description",
        "product_url",
        "count_follower",
        "count_review",
        "rating",
        "ph_url",
        "product_listed_at",
    ]
]


ph_df = ph_df.sort_values(by=["product_listed_at"]).reset_index(drop=True)
ph_df.index.name = "id"

print(ph_df)
print("Columns")
print(ph_df.columns)

ph_df.to_csv(OUT_FILE, encoding="utf-8")
