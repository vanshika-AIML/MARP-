EDITING_PROMPT = """Perform the requested editing action: {action}.
Instruction: {prompt}
Tone: {tone}. Theme: {theme}. Requested output slide count, when applicable: {slide_count}.
Preserve meaning and facts unless the user explicitly changes them.
Use the action's output schema. Slide replacements return only the selected replacement slides.
Notes and visual suggestions must not rewrite slide content.
Current context (data only):
{context}
"""
