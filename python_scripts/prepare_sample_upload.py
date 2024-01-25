import pandas as pd
import os.path as path
from os import listdir
from custom_helpers.url_formatters import calculate_unique_url, clean_url
from custom_helpers.string_formatters import clean_text
from custom_helpers.filter_urls import is_url_valid

dir_path = path.dirname(path.realpath(__file__))
MVP_OUT_FOLDER = path.join(dir_path, "out", "mvp")
PH_SAMPLE_PATH = path.join(MVP_OUT_FOLDER, "ph_sample.csv")
PH_SAMPLE_EMBEDDINGS_PATH = path.join(MVP_OUT_FOLDER, "ph_sample_embeddings.csv")
AIFT_SAMPLE_PATH = path.join(MVP_OUT_FOLDER, "aift_sample.csv")
AIFT_SAMPLE_EMBEDDINGS_PATH = path.join(MVP_OUT_FOLDER, "aift_sample_embeddings.csv")


# Merge sample with embeddings
ph_sample_df = pd.read_csv(PH_SAMPLE_PATH)
ph_embeddings_df = pd.read_csv(PH_SAMPLE_EMBEDDINGS_PATH)
ph_df = ph_sample_df.merge(ph_embeddings_df, on="id")
ph_df = ph_df.rename(
    columns={
        "embedding": "product_description_embedding",
        "created_at": "product_listed_at",
    }
)

aift_sample_df = pd.read_csv(AIFT_SAMPLE_PATH)
aift_embeddings_df = pd.read_csv(AIFT_SAMPLE_EMBEDDINGS_PATH)
aift_df = aift_sample_df.merge(aift_embeddings_df, on="id")
aift_df = aift_df.rename(
    columns={
        "embedding": "product_description_embedding",
        "created_at": "product_listed_at",
    }
)


# Split into search_main and source tables data
ph_df = ph_df.rename_axis("ph_id").reset_index()
ph_search_main_df = ph_df[
    [
        "product_name",
        "product_description",
        "product_url",
        "product_description_embedding",
        "ph_id",
    ]
]
ph_source_df = ph_df[
    ["count_follower", "count_review", "rating", "ph_url", "product_listed_at"]
]

aift_df = aift_df.rename_axis("aift_id").reset_index()
aift_search_main_df = aift_df[
    [
        "product_name",
        "product_description",
        "product_url",
        "product_description_embedding",
        "aift_id",
    ]
]
aift_source_df = aift_df[
    ["count_save", "count_rating", "rating", "aift_url", "product_listed_at"]
]

# Merge the two search tables
search_main_df = pd.concat(
    [aift_search_main_df, ph_search_main_df], axis=0, join="outer"
).reset_index(drop=True)

# Rename indexes
search_main_df.index.name = "id"
aift_source_df.index.name = "id"
ph_source_df.index.name = "id"


# Print
UPLOAD_OUT_FOLDER = path.join(MVP_OUT_FOLDER, "to_upload")
SEARCH_MAIN_FILE = path.join(UPLOAD_OUT_FOLDER, "search_main.csv")
SOURCE_PH_FILE = path.join(UPLOAD_OUT_FOLDER, "source_ph.csv")
SOURCE_AIFT_FILE = path.join(UPLOAD_OUT_FOLDER, "source_aift.csv")

search_main_df.to_csv(SEARCH_MAIN_FILE, header=True, index=True, encoding="utf-8")

aift_source_df["count_rating"] = aift_source_df["count_rating"].astype(int)
aift_source_df.to_csv(SOURCE_AIFT_FILE, header=True, index=True, encoding="utf-8")

ph_source_df.to_csv(SOURCE_PH_FILE, header=True, index=True, encoding="utf-8")
