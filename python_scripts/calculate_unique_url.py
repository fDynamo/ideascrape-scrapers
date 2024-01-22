from urllib.parse import urlencode, urlparse, urlunparse, parse_qs, urljoin


def calculate_unique_url(in_url: str) -> str:
    # Lowercase url
    in_url = in_url.lower()

    # Remove query params
    in_url = urljoin(in_url, urlparse(in_url).path)

    # Replace beginning https
    if in_url.startswith("https://"):
        in_url = in_url[8:]

    # Replace beginning www
    if in_url.startswith("www."):
        in_url = in_url[4:]

    # Replace slash with underscore
    in_url = in_url.replace("/", "_")

    # Remove ending slash
    if in_url[-1] == "_":
        in_url = in_url[:-1]

    return in_url


if __name__ == "__main__":
    test_url = "https://theresanaiforthat.com/ai/songwraiter/?ref=alternative"
    print(calculate_unique_url(test_url))
