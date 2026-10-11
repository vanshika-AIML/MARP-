"""Conservative parsing of headings, lists, quotes, fenced code, tables and notes."""

import html
import json
import re

import yaml
from pydantic import ValidationError

from app.schemas.ai import StructuredBlock, StructuredPresentation, StructuredSlide, VisualIntent
from app.schemas.visuals import MediaReference
from app.services.marp import split_markdown
from app.services.presentations.marp_compiler import MEDIA, NOTES, VISUAL


def unescape(value: str) -> str:
    return html.unescape(re.sub(r"\\([\\`*_{}\[\]<>#!|\-])", r"\1", value))


def table_cells(line: str) -> list[str]:
    return [
        unescape(cell.strip().replace("<br>", "\n"))
        for cell in re.split(r"(?<!\\)\|", line.strip().strip("|"))
    ]


def parse_slide(raw: str, *, fallback_title: str = "Untitled slide") -> StructuredSlide:
    title, kind, notes, intent = fallback_title, "content", None, VisualIntent()
    media = None
    # Protect code before extracting our comments, which can themselves occur in code examples.
    lines, index, content = raw.splitlines(), 0, []
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        fence = re.match(r"^ {0,3}(`{3,}|~{3,})([\w+.-]*)\s*$", line)
        if fence:
            index += 1
            code = []
            while index < len(lines) and not re.fullmatch(
                r" {0,3}" + re.escape(fence[1][0]) + "{" + str(len(fence[1])) + r",}\s*",
                lines[index],
            ):
                code.append(lines[index])
                index += 1
            content.append(StructuredBlock(kind="code", language=fence[2], text="\n".join(code)))
        elif line.startswith("<pre><code>"):
            code = [line]
            while "</code></pre>" not in code[-1] and index + 1 < len(lines):
                index += 1
                code.append(lines[index])
            value = "\n".join(code).removeprefix("<pre><code>").removesuffix("</code></pre>")
            content.append(StructuredBlock(kind="code", text=html.unescape(value)))
        elif line == "<!-- marp-media-start -->":
            while index + 1 < len(lines):
                index += 1
                if lines[index] == "<!-- marp-media-end -->":
                    break
                if match := MEDIA.fullmatch(lines[index]):
                    try:
                        media = MediaReference.model_validate_json(match[1])
                    except (ValueError, ValidationError):
                        pass
        elif line.startswith("<!--"):
            comment = [line]
            while "-->" not in comment[-1] and index + 1 < len(lines):
                index += 1
                comment.append(lines[index])
            value = "\n".join(comment)
            if match := NOTES.fullmatch(value):
                notes = html.unescape(match[1])
            elif match := VISUAL.fullmatch(value):
                try:
                    intent = VisualIntent.model_validate(json.loads(match[1]))
                except (ValueError, ValidationError):
                    pass  # Nonstandard existing comments remain in canonical Markdown.
            elif match := re.search(r"_class:\s*([\w-]+)", value):
                candidate = match[1].replace("-", "_")
                kind = {"lead": "title"}.get(candidate, candidate)
                if kind not in {
                    "title",
                    "content",
                    "image_text",
                    "quote",
                    "stats",
                    "code",
                    "table",
                    "section",
                }:
                    kind = "content"
        elif re.match(r"^#{1,2} ", line) and title == fallback_title:
            title = unescape(re.sub(r"^#{1,2} ", "", line))[:200] or fallback_title
        elif line.startswith("- "):
            items = [unescape(line[2:])]
            while index + 1 < len(lines) and lines[index + 1].startswith("- "):
                index += 1
                items.append(unescape(lines[index][2:]))
            content.append(StructuredBlock(kind="bullets", items=items))
        elif line.startswith("> "):
            quote_lines = [unescape(line[2:])]
            while index + 1 < len(lines) and lines[index + 1].startswith("> "):
                index += 1
                quote_lines.append(unescape(lines[index][2:]))
            content.append(StructuredBlock(kind="quote", text="\n".join(quote_lines)))
        elif (
            line.startswith("|")
            and index + 1 < len(lines)
            and re.fullmatch(r"[| :\-]+", lines[index + 1])
        ):
            headers, rows = table_cells(line), []
            index += 1
            while index + 1 < len(lines) and lines[index + 1].startswith("|"):
                index += 1
                row = table_cells(lines[index])
                rows.append((row + [""] * len(headers))[: len(headers)])
            content.append(StructuredBlock(kind="table", headers=headers, rows=rows))
        elif match := re.fullmatch(r"!\[(.*)\]\((https?://[^ ]+)\)", line):
            content.append(StructuredBlock(kind="image", alt=unescape(match[1]), url=match[2]))
        else:
            content.append(StructuredBlock(kind="paragraph", text=unescape(line)))
        index += 1
    return StructuredSlide(
        type=kind,
        title=title,
        content=content,
        speaker_notes=notes,
        visual_intent=intent,
        media=media,
    )


def parse_markdown(markdown: str, *, fallback_title: str = "Untitled presentation"):
    document = split_markdown(markdown)
    header = yaml.safe_load("\n".join(document.frontmatter.splitlines()[1:-1])) or {}
    theme = header.get("theme", "minimal")
    if not isinstance(theme, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,99}", theme):
        theme = "minimal"
    title = header.get("title", fallback_title)
    subtitle = header.get("description")
    slides = [parse_slide(raw) for raw in document.slides]
    return StructuredPresentation(
        title=str(title)[:200] or fallback_title,
        subtitle=str(subtitle)[:500] if subtitle is not None else None,
        theme=theme,
        slides=slides or [StructuredSlide(title=fallback_title)],
    )
