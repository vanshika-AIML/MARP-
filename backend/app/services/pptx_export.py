"""Editable themed text and stored media; HTML/PDF preserve exact CSS styling."""

import re
from io import BytesIO

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt

from app.services.marp import split_markdown


def export_pptx(title: str, markdown: str, style=None, media=None) -> bytes:
    style = style or {"background": "#ffffff", "text": "#0f172a", "accent": "#0284c7"}
    media = media or {}
    document = split_markdown(markdown)
    deck = Presentation()
    deck.slide_width, deck.slide_height = Inches(13.333333), Inches(7.5)
    deck.core_properties.title = title
    for index, raw in enumerate(document.slides):
        slide = deck.slides.add_slide(deck.slide_layouts[6])
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = RGBColor.from_string(style["background"][1:])
        images = [
            (match.group(1), media[match.group(1)])
            for match in re.finditer(r"/media/([0-9a-f-]{36})/file", raw)
            if match.group(1) in media
        ]
        image_present = bool(images)
        full_bleed = image_present and "visual-full-bleed" in raw
        if full_bleed:
            slide.shapes.add_picture(str(images[0][1]), 0, 0, deck.slide_width, deck.slide_height)
        content = re.sub(r"<!--.*?-->", "", raw, flags=re.S)
        lines = content.strip().splitlines()
        heading = next((line for line in lines if re.match(r"^#{1,6}\s", line)), None)
        label = re.sub(r"^#{1,6}\s+", "", heading) if heading else f"Slide {index + 1}"
        if heading:
            lines.remove(heading)
        box = slide.shapes.add_textbox(Inches(0.6), Inches(0.45), Inches(12.1), Inches(1))
        box.text_frame.paragraphs[0].text = label
        box.text_frame.paragraphs[0].font.size = Pt(32)
        box.text_frame.paragraphs[0].font.bold = True
        box.text_frame.paragraphs[0].font.color.rgb = RGBColor.from_string(style["text"][1:])
        body = slide.shapes.add_textbox(
            Inches(0.6), Inches(1.6), Inches(6.1 if image_present else 12.1), Inches(5.3)
        )
        body.text_frame.word_wrap = True
        text = "\n".join(lines).strip()
        # Keep image alt text and link destinations without fetching remote URLs.
        text = re.sub(
            r"!\[([^\]]*)\]\(([^)]*)\)",
            lambda match: "" if "/media/" in match[2] else f"[Linked image: {match[1]}]",
            text,
        )
        text = re.sub(r"\[([^\]]+)\]\(([^)]*)\)", r"\1 (\2)", text)
        for line_index, line in enumerate(text.splitlines()):
            paragraph = (
                body.text_frame.paragraphs[0]
                if line_index == 0 else body.text_frame.add_paragraph()
            )
            paragraph.text = re.sub(r"(?<!\w)[*_`]+|[*_`]+(?!\w)", "", line)
            if paragraph.text.startswith("- "):
                paragraph.text = "• " + paragraph.text[2:]
            paragraph.font.color.rgb = RGBColor.from_string(style["text"][1:])
            paragraph.font.size = Pt(18 if len(text) > 900 else 24)
        if image_present and not full_bleed:
            # A contained image preserves aspect ratio and leaves editable text beside it.
            picture = slide.shapes.add_picture(str(images[0][1]), Inches(7.2), Inches(1.8))
            ratio = min(Inches(5.5) / picture.width, Inches(4.9) / picture.height)
            picture.width, picture.height = int(picture.width * ratio), int(picture.height * ratio)
        slide.notes_slide.notes_text_frame.text = raw
    output = BytesIO()
    deck.save(output)
    return output.getvalue()
