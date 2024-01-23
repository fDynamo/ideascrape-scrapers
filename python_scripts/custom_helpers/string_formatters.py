import re

CAMEL2SNAKE = re.compile(r"(?<!^)(?=[A-Z])")


def camel_to_snake_case(in_str: str) -> str:
    return re.sub(CAMEL2SNAKE, "_", in_str).lower()


# Removes non alphanumeric text and new lines
def clean_text(in_text: str) -> str:
    if not in_text or not isinstance(in_text, str):
        return ""
    in_text = in_text.replace("\n", " ")
    in_text = cleanhtml(in_text)
    return in_text


CLEANR = re.compile("<.*?>")


def cleanhtml(raw_html):
    cleantext = re.sub(CLEANR, "", raw_html)
    return cleantext
