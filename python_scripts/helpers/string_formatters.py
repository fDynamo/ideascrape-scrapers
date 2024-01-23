import re


def camel_to_snake_case(in_str: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", in_str).lower()
