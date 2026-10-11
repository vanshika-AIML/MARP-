PRESENTATION_PROMPT = """Create a structured MARP presentation for this request:
{prompt}

Constraints:
- target {slide_count} slides (between 1 and 40)
- tone: {tone}
- theme slug: {theme}
- use title, content, section, quote, stats, code, table, or image_text types where appropriate
- make the opening establish the idea and the ending give a clear takeaway
- vary layouts and keep each slide scannable
"""

OUTLINE_PROMPT = """Create a concise structured presentation outline for:
{prompt}

Use {slide_count} slides with titles and short content items. Focus on sequence and storytelling.
Do not write long prose or invent facts. Tone: {tone}. Theme: {theme}.
"""
