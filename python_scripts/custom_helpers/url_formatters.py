def calculate_unique_url(in_url: str) -> str:
    in_url = clean_url(in_url)  # Replace slash with underscore

    in_url = in_url.replace("/", "_")

    return in_url


def clean_url(in_url: str) -> str:
    # Lowercase url
    in_url = in_url.lower()

    # Remove query params
    question_mark_index = in_url.find("?")
    if question_mark_index > -1:
        in_url = in_url[:question_mark_index]

    # Replace beginning https
    if in_url.startswith("https://"):
        in_url = in_url[8:]

    # Replace beginning www
    if in_url.startswith("www."):
        in_url = in_url[4:]

    # Remove trailing slash
    if in_url[-1] == "/":
        in_url = in_url[:-1]

    return in_url


if __name__ == "__main__":
    test_url = "https://theresanaiforthat.com/ai/songwraiter/?ref=alternative"
    print(calculate_unique_url(test_url))
