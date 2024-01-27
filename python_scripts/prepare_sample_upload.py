import pandas as pd
import os.path as path
from custom_helpers.get_paths import get_out_folder


MVP_OUT_FOLDER = get_out_folder("mvp")
PH_SAMPLE_PATH = path.join(MVP_OUT_FOLDER, "ph_sample.csv")
PH_SAMPLE_EMBEDDINGS_PATH = path.join(MVP_OUT_FOLDER, "ph_sample_embeddings.csv")
AIFT_SAMPLE_PATH = path.join(MVP_OUT_FOLDER, "aift_sample.csv")
AIFT_SAMPLE_EMBEDDINGS_PATH = path.join(MVP_OUT_FOLDER, "aift_sample_embeddings.csv")


UPLOAD_OUT_FOLDER = get_out_folder("mvp_to_upload")
SEARCH_MAIN_FILE = path.join(UPLOAD_OUT_FOLDER, "search_main.csv")
SOURCE_PH_FILE = path.join(UPLOAD_OUT_FOLDER, "source_ph.csv")
SOURCE_AIFT_FILE = path.join(UPLOAD_OUT_FOLDER, "source_aift.csv")

NUM_ROWS = 8

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
ph_df["count_follower"] = ph_df["count_follower"].astype(int)
ph_df["count_review"] = ph_df["count_review"].astype(int)

aift_sample_df = pd.read_csv(AIFT_SAMPLE_PATH)
aift_embeddings_df = pd.read_csv(AIFT_SAMPLE_EMBEDDINGS_PATH)
aift_df = aift_sample_df.merge(aift_embeddings_df, on="id")
aift_df = aift_df.rename(
    columns={
        "embedding": "product_description_embedding",
        "created_at": "product_listed_at",
    }
)

# Fix aift star ratings

# Remove star ratings
aift_df = aift_df.drop(["rating"], axis=1)

# Import extract
AIFT_EXTRACT_PATH = path.join(MVP_OUT_FOLDER, "aift_extract.csv")
aift_extract_df = pd.read_csv(AIFT_EXTRACT_PATH, encoding="utf-8")
aift_extract_df = aift_extract_df[["aift_url", "rating"]]

# Merge on post url
aift_df = aift_df.merge(aift_extract_df, on="aift_url")

# Sample dfs accordingly
HALF_NUM_ROWS = round(NUM_ROWS / 2)
aift_df = aift_df.sample(HALF_NUM_ROWS).reset_index(drop=True)
ph_df = ph_df.sample(HALF_NUM_ROWS).reset_index(drop=True)

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
search_main_df = (
    pd.concat([aift_search_main_df, ph_search_main_df], axis=0, join="outer")
    .dropna(subset="product_description")
    .reset_index(drop=True)
)

# Merge just the ph and aift ids
search_main_ids_df = aift_search_main_df[["product_url", "aift_id"]].merge(
    ph_search_main_df[["product_url", "ph_id"]], how="outer", on="product_url"
)

# Remove duplicates in main df based on description length
search_main_df["description_length"] = search_main_df["product_description"].apply(len)
search_main_df = search_main_df.sort_values(by="description_length", ascending=True)
search_main_df = search_main_df.drop_duplicates(subset="product_url", keep="last")

# Bring search main ids back
search_main_df = search_main_df.drop(["description_length", "ph_id", "aift_id"], axis=1)
search_main_df = search_main_df.merge(search_main_ids_df, on="product_url")


# Rename indexes
search_main_df.index.name = "id"
aift_source_df.index.name = "id"
ph_source_df.index.name = "id"

# Cast as ints
search_main_df["ph_id"] = search_main_df["ph_id"].astype("Int64")
search_main_df["aift_id"] = search_main_df["aift_id"].astype("Int64")


# Print


search_main_df.to_csv(SEARCH_MAIN_FILE, header=True, index=True, encoding="utf-8")

aift_source_df["count_rating"] = aift_source_df["count_rating"].astype(int)
aift_source_df.to_csv(SOURCE_AIFT_FILE, header=True, index=True, encoding="utf-8")

ph_source_df.to_csv(SOURCE_PH_FILE, header=True, index=True, encoding="utf-8")
