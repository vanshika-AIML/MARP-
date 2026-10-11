"""Compile validated data, never executable model HTML, into MARP Markdown."""

import html
import json
import re
from urllib.parse import quote

import yaml

from app.schemas.ai import StructuredBlock, StructuredPresentation, StructuredSlide
from app.services.marp import compile_markdown
from app.services.visuals.layouts import MEDIA_CSS

NOTES = re.compile(r"<!-- speaker notes\n(.*?)\n-->", re.S)
VISUAL = re.compile(r"<!-- marp-visual: (.*?) -->")
MEDIA = re.compile(r"<!-- marp-media: (.*?) -->")


def media_markdown(media):
    value = json.dumps(media.model_dump(mode="json"), ensure_ascii=True)
    value = value.replace("<", r"\u003c").replace(">", r"\u003e")
    directives = {
        "full_bleed": "bg cover",
        "split": "bg right:45% cover",
        "background": "bg cover opacity:0.25",
        "hero": "w:1000 h:300",
        "framed": "w:900 h:420",
    }[media.placement]
    alt = text(media.alt_text).replace("\n", " ")
    lines = [
        "<!-- marp-media-start -->",
        f"<!-- marp-media: {value} -->",
        f"![{directives} {alt}]({media.url})",
    ]
    if media.attribution:
        credit = text(media.attribution).replace("\n", " ")
        if media.source_url:
            url = quote(str(media.source_url), safe=":/?=&%#@+;,-._~")
            credit = f"[{credit}]({url})"
        lines.append("Source: " + credit)
    lines.append("<!-- marp-media-end -->")
    return "\n\n".join(lines)


def text(value: str) -> str:
    value = html.escape(value, quote=False)
    value = re.sub(r"([\\`*_{}\[\]<>#!|])", r"\\\1", value)
    return re.sub(r"(?m)^(\s*)(---)(\s*)$", r"\1\\---\3", value)


def notes_comment(notes: str | None) -> str:
    if not notes:
        return ""
    safe = html.escape(notes, quote=False)
    safe = re.sub(r"(?m)^(\s*)---(\s*)$", r"\1&#45;&#45;&#45;\2", safe)
    return f"<!-- speaker notes\n{safe}\n-->"


def visual_comment(intent) -> str:
    # One line keeps visual suggestions out of the rendered slide and front-end splitter.
    value = json.dumps(intent.model_dump(), ensure_ascii=True).replace("<", r"\u003c")
    value = value.replace(">", r"\u003e")
    return f"<!-- marp-visual: {value} -->"


def remove_metadata(raw: str, pattern: re.Pattern) -> str:
    """Remove our top-level comments without altering literal code examples."""
    lines, kept, index, fence = raw.splitlines(keepends=True), [], 0, ""
    in_pre = False
    while index < len(lines):
        line = lines[index]
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence:
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                if not marker[2].strip():
                    fence = ""
        elif in_pre:
            in_pre = "</pre>" not in line
        elif marker:
            fence = marker[1]
        elif line.startswith("<pre"):
            in_pre = "</pre>" not in line
        elif line.startswith("<!--"):
            comment = [line]
            while "-->" not in comment[-1] and index + 1 < len(lines):
                index += 1
                comment.append(lines[index])
            value = "".join(comment)
            if not pattern.fullmatch(value.rstrip("\r\n")):
                kept.append(value)
            index += 1
            continue
        kept.append(line)
        index += 1
    return "".join(kept).rstrip()


def update_notes(raw: str, notes: str) -> str:
    base = remove_metadata(raw, NOTES)
    return base + "\n\n" + notes_comment(notes)


def update_visual(raw: str, intent) -> str:
    return remove_metadata(raw, VISUAL) + "\n\n" + visual_comment(intent)


def block_markdown(block: str | StructuredBlock) -> str:
    if isinstance(block, str):
        return text(block)
    if block.kind == "paragraph":
        return text(block.text)
    if block.kind == "bullets":
        return "\n".join("- " + text(item).replace("\n", "\n  ") for item in block.items)
    if block.kind == "code":
        # The existing frontend splitter treats a bare --- inside code as a slide break.
        # An escaped pre block handles that uncommon case without changing the frontend.
        if re.search(r"(?m)^\s*---\s*$", block.text):
            return "<pre><code>" + html.escape(block.text).replace("\n", "&#10;") + "</code></pre>"
        length = max([len(run) for run in re.findall(r"`+", block.text)] + [2]) + 1
        fence = "`" * length
        return f"{fence}{block.language or ''}\n{block.text}\n{fence}"
    if block.kind == "quote":
        return "> " + text(block.text).replace("\n", "\n> ")
    if block.kind == "stat":
        return f"### {text(block.value)}\n\n{text(block.label)}"
    if block.kind == "table":

        def row(values):
            return "| " + " | ".join(text(cell).replace("\n", "<br>") for cell in values) + " |"

        return "\n".join(
            [
                row(block.headers),
                "| " + " | ".join("---" for _ in block.headers) + " |",
                *[row(values) for values in block.rows],
            ]
        )
    if block.url:
        url = quote(str(block.url), safe=":/?=&%#@+;,-._~")
        return f"![{text(block.alt or 'Image')}]({url})"
    return f"> Image placeholder: {text(block.alt or 'Visual to be supplied')}"


def compile_slide(slide: StructuredSlide) -> str:
    layout = "lead" if slide.type in {"title", "section"} else slide.type.replace("_", "-")
    if slide.media:
        layout += " visual-" + slide.media.placement.replace("_", "-")
    parts = [f"<!-- _class: {layout} -->", f"# {text(slide.title).replace(chr(10), ' ')}"]
    parts.extend(block_markdown(block) for block in slide.content)
    if slide.media:
        parts.append(media_markdown(slide.media))
    if slide.visual_intent.type != "none":
        parts.append(visual_comment(slide.visual_intent))
    if slide.speaker_notes:
        parts.append(notes_comment(slide.speaker_notes))
    return "\n\n".join(part for part in parts if part)


def frontmatter(deck: StructuredPresentation) -> str:
    lines = [
        "---",
        "marp: true",
        f"theme: {deck.theme}",
        "paginate: true",
        "title: " + json.dumps(deck.title, ensure_ascii=True),
    ]
    if deck.subtitle:
        lines.append("description: " + json.dumps(deck.subtitle, ensure_ascii=True))
    return "\n".join([*lines, "---"])


def compile_presentation(deck: StructuredPresentation, *, header: str | None = None) -> str:
    header = media_header(frontmatter(deck) if header is None else header, deck)
    return compile_markdown(header, [compile_slide(s) for s in deck.slides])


def media_header(header, deck):
    if not any(slide.media for slide in deck.slides):
        return header
    values = yaml.safe_load("\n".join(header.splitlines()[1:-1])) or {}
    existing = str(values.get("style", ""))
    if "/* marp-studio-media-v1 */" not in existing:
        values["style"] = existing + "\n" + MEDIA_CSS
    return "---\n" + yaml.safe_dump(values, sort_keys=False).rstrip() + "\n---"
