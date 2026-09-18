import { describe, expect, it } from 'vitest';
import { parseMarpPresentation, rebuildPresentationMarkdown, splitFrontmatter } from './marpParser';

describe('presentation Markdown helpers', () => {
  it('inserts a duplicate immediately after the selected slide without duplicating frontmatter', () => {
    const markdown = '---\nmarp: true\ntheme: gaia\n---\n\n# One\n\n---\n\n# Two\n\n---\n\n# Three';
    const parsed = parseMarpPresentation(markdown);
    const { frontmatter } = splitFrontmatter(markdown);
    const slides = [...parsed.slides];
    slides.splice(2, 0, { ...slides[1] });
    const rebuilt = rebuildPresentationMarkdown(frontmatter, slides);
    const result = parseMarpPresentation(rebuilt);

    expect(result.slides.map((slide) => slide.content)).toEqual(['# One', '# Two', '# Two', '# Three']);
    expect(rebuilt.match(/marp: true/g)).toHaveLength(1);
  });
});
