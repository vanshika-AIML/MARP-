"""Small MARP compiler: preserve frontmatter and ignore separators in code/comments.

This does not render Markdown or interpret theme CSS/JavaScript. Slide-level edits
must contain one slide; complete Markdown edits are split by this same helper.
"""

import re
from dataclasses import dataclass

import yaml

BREAK = re.compile(r"^ {0,3}---[ \t]*$")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
MAX_SLIDES = 1000


@dataclass(frozen=True)
class Document:
    frontmatter: str
    slides: list[str]


def split_markdown(markdown: str) -> Document:
    normalized = markdown.replace("\r\n", "\n").removeprefix("\ufeff")
    lines = normalized.split("\n")
    frontmatter = ""
    if lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() in {"---", "..."}:
                try:
                    header = yaml.safe_load("\n".join(lines[1:index]))
                except yaml.YAMLError as exc:
                    raise ValueError("Invalid YAML frontmatter") from exc
                if isinstance(header, dict):
                    frontmatter = "\n".join(lines[: index + 1])
                    lines = lines[index + 1 :]
                break
    if not "\n".join(lines).strip():
        return Document(frontmatter, [])
    slides, current = [], []
    fence_char, fence_length, in_comment = "", 0, False
    for line in lines:
        match = FENCE.match(line) if not in_comment else None
        if fence_char:
            if match and match[1][0] == fence_char and len(match[1]) >= fence_length:
                if not match[2].strip():
                    fence_char = ""
        elif match:
            fence_char, fence_length = match[1][0], len(match[1])
        elif not in_comment and BREAK.match(line):
            slides.append("\n".join(current).strip("\n"))
            current = []
            continue
        elif not fence_char:
            for token in re.findall(r"<!--|-->", line):
                in_comment = token == "<!--"
        current.append(line)
    slides.append("\n".join(current).strip("\n"))
    if len(slides) > MAX_SLIDES:
        raise ValueError(f"A presentation may contain at most {MAX_SLIDES} slides")
    return Document(frontmatter, slides)


def compile_markdown(frontmatter: str, slides: list[str]) -> str:
    body = "\n\n---\n\n".join(slide.strip("\n") for slide in slides)
    return f"{frontmatter}\n\n{body}" if frontmatter else body


def validate_slide(markdown: str) -> None:
    document = split_markdown(markdown)
    if document.frontmatter or len(document.slides) > 1:
        raise ValueError("raw_markdown must contain one slide without global frontmatter")
