"""Editable text export. HTML/PDF remain the options for exact slide styling."""

import re
from io import BytesIO

from pptx import Presentation
from pptx.util import Inches, Pt

from app.services.marp import split_markdown


def export_pptx(title: str, markdown: str) -> bytes:
    document = split_markdown(markdown)
    deck = Presentation()
    deck.slide_width, deck.slide_height = Inches(13.333333), Inches(7.5)
    deck.core_properties.title = title
    for index, raw in enumerate(document.slides):
        slide = deck.slides.add_slide(deck.slide_layouts[6])
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
        body = slide.shapes.add_textbox(Inches(0.6), Inches(1.6), Inches(12.1), Inches(5.3))
        body.text_frame.word_wrap = True
        text = "\n".join(lines).strip()
        # Keep image alt text and link destinations without fetching remote URLs.
        text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"[Image: \1]", text)
        text = re.sub(r"\[([^\]]+)\]\(([^)]*)\)", r"\1 (\2)", text)
        for line_index, line in enumerate(text.splitlines()):
            paragraph = (
                body.text_frame.paragraphs[0]
                if line_index == 0 else body.text_frame.add_paragraph()
            )
            paragraph.text = line
            paragraph.font.size = Pt(18 if len(text) > 900 else 24)
        slide.notes_slide.notes_text_frame.text = raw
    output = BytesIO()
    deck.save(output)
    return output.getvalue()
