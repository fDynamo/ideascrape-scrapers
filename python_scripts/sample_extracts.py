import os.path as path
import pandas as pd
import sys
from custom_helpers.get_paths import get_master_out_folder


MVP_OUT_FOLDER = path.join(get_master_out_folder(), "mvp")

aift_extract = path.join(MVP_OUT_FOLDER, "aift_extract.csv")
aift_sample_out = path.join(MVP_OUT_FOLDER, "aift_sample.csv")

ph_extract = path.join(MVP_OUT_FOLDER, "ph_extract.csv")
ph_sample_out = path.join(MVP_OUT_FOLDER, "ph_sample.csv")

# Sample
COUNT_SAMPLED_ROWS = 10

try:
    if sys.argv[1]:
        COUNT_SAMPLED_ROWS = int(sys.argv[1])
except:
    pass

aift_df = pd.read_csv(aift_extract)
aift_sample = aift_df.sample(n=COUNT_SAMPLED_ROWS)
aift_sample.to_csv(aift_sample_out, index=False, encoding="utf-8")

ph_df = pd.read_csv(ph_extract)
ph_sample = ph_df.sample(n=COUNT_SAMPLED_ROWS)
ph_sample.to_csv(ph_sample_out, index=False, encoding="utf-8")
