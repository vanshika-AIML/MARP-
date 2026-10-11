"""Only media layout hooks; existing theme styles and typography remain in control."""

MEDIA_CSS = """/* marp-studio-media-v1 */
section.visual-hero img, section.visual-framed img {
  object-fit: cover; display: block; margin: 0.6em auto;
}
section.visual-framed img {
  border: 1px solid currentColor; border-radius: 6px; padding: 5px;
  box-shadow: 0 8px 24px #0002;
}
section.visual-full-bleed { color: #fff; text-shadow: 0 2px 8px #000b; }
section.visual-full-bleed h1 { color: inherit; }
"""
