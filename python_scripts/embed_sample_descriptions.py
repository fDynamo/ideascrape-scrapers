import os.path as path
import csv
from openai import OpenAI
from custom_helpers.get_paths import get_out_folder
from dotenv import load_dotenv

load_dotenv()

MVP_OUT_FOLDER = get_out_folder("mvp")

aift_sample = path.join(MVP_OUT_FOLDER, "aift_sample.csv")
ph_sample = path.join(MVP_OUT_FOLDER, "ph_sample.csv")

aift_sample_embeddings_filepath = path.join(
    MVP_OUT_FOLDER, "aift_sample_embeddings.csv"
)

ph_sample_embeddings_filepath = path.join(MVP_OUT_FOLDER, "ph_sample_embeddings.csv")

client = OpenAI()


def embed_sample(sample_filepath, out_write_filepath):
    with open(out_write_filepath, "w", encoding="utf-8") as out_write_file:
        fieldnames = ["id", "embedding"]
        curr_writer = csv.DictWriter(out_write_file, fieldnames=fieldnames)
        curr_writer.writeheader()

        with open(sample_filepath, "r", encoding="utf-8") as curr_file:
            csv_reader = csv.DictReader(curr_file)
            i = 0
            for row in csv_reader:
                id = row["id"]
                desc = row["product_description"]
                embedding = (
                    client.embeddings.create(
                        model="text-embedding-ada-002",
                        input=desc,
                        encoding_format="float",
                    )
                    .data[0]
                    .embedding
                )
                curr_writer.writerow({"id": id, "embedding": str(embedding)})
                print("Row done")
                print(i)
                i += 1


embed_sample(aift_sample, aift_sample_embeddings_filepath)
embed_sample(ph_sample, ph_sample_embeddings_filepath)
