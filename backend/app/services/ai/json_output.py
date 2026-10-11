"""Conservative syntactic repair; no evaluation or invented fields."""

import json
import re


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _reject_constant(_value):
    raise ValueError("Non-finite JSON number")


def parse_json(raw: str):
    if len(raw) > 1_000_000:
        raise ValueError("Model output exceeds limit")
    value = raw.strip()
    if value.startswith("<think>") and "</think>" in value:
        value = value.split("</think>", 1)[1].strip()
    if match := re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", value, flags=re.I | re.S):
        value = match[1]
    # Remove trailing commas only outside JSON strings. Never alter quoted content.
    result, quoted, escaped = [], False, False
    for index, char in enumerate(value):
        if quoted:
            result.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        else:
            if char == '"':
                quoted = True
            if char == "," and value[index + 1 :].lstrip().startswith(("}", "]")):
                continue
            result.append(char)
    return json.loads(
        "".join(result), object_pairs_hook=_unique_object, parse_constant=_reject_constant
    )
