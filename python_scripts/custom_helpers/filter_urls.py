import json
from os.path import dirname, join, realpath
import validators


def is_url_valid(in_clean_url: str) -> str:
    if not in_clean_url or not isinstance(in_clean_url, str):
        return False

    if not validators.url("https://" + in_clean_url):
        return False

    # Remove if http
    if in_clean_url.startswith("http"):
        return False

    # Opening
    dir_path = dirname(realpath(__file__))
    url_filters_path = join(dir_path, "url_filters.json")
    url_filters_file = open(url_filters_path)
    url_filters = json.load(url_filters_file)

    substrings = url_filters["substrings"]
    for substring in substrings:
        if substring in in_clean_url:
            return False

    starts = url_filters["starts"]
    for start in starts:
        if in_clean_url.startswith(start):
            return False

    ends = url_filters["ends"]
    for end in ends:
        if in_clean_url.endswith(end):
            return False

    url_filters_file.close()
    return True


if __name__ == "__main__":
    test_url = "amazon.com/ai/songwraiter/?ref=alternative"
    print(is_url_valid(test_url))
