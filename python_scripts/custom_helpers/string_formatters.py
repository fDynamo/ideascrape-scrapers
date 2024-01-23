import re


def camel_to_snake_case(in_str: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", in_str).lower()


# Removes non alphanumeric text and new lines
def clean_text(in_text: str) -> str:
    if not in_text or not isinstance(in_text, str):
        return ""
    in_text = in_text.replace("\n", " ")
    return in_text
