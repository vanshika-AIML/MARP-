/**
 * MARP Markdown Parser & Slide Splitter
 * Extracts global frontmatter, splits slides by horizontal rules (`---`),
 * and parses local & scoped MARP directives.
 */

export function parseMarpPresentation(rawMarkdown = '') {
  if (!rawMarkdown) {
    return {
      globalDirectives: { theme: 'default', paginate: false },
      slides: [
        {
          index: 0,
          raw: '',
          content: '',
          directives: { theme: 'default' },
          startLine: 1,
          endLine: 1,
        },
      ],
    };
  }

  const lines = rawMarkdown.split(/\r?\n/);
  let globalDirectives = { theme: 'default', paginate: false, marp: true };
  let startIndex = 0;

  // 1. Check for YAML Frontmatter at the very top: `---` ... `---`
  if (lines[0]?.trim() === '---') {
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd !== -1) {
      const fmLines = lines.slice(1, frontmatterEnd);
      globalDirectives = { ...globalDirectives, ...parseDirectivesList(fmLines) };
      startIndex = frontmatterEnd + 1;
    }
  }

  // 2. Split remainder into individual slides by `---` (on its own line)
  const slides = [];
  let currentSlideLines = [];
  let currentStartLine = startIndex + 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const isSlideBreak = line.trim() === '---';

    if (isSlideBreak) {
      // Finalize preceding slide
      const slideRaw = currentSlideLines.join('\n');
      const { content, directives } = parseSlideDirectives(slideRaw, globalDirectives);
      
      slides.push({
        index: slides.length,
        raw: slideRaw,
        content,
        directives: { ...globalDirectives, ...directives },
        startLine: currentStartLine,
        endLine: Math.max(currentStartLine, i),
      });

      currentSlideLines = [];
      currentStartLine = i + 2; // Next slide starts after `---`
    } else {
      currentSlideLines.push(line);
    }
  }

  // Final slide
  const lastSlideRaw = currentSlideLines.join('\n');
  const { content: lastContent, directives: lastDirectives } = parseSlideDirectives(
    lastSlideRaw,
    globalDirectives
  );

  slides.push({
    index: slides.length,
    raw: lastSlideRaw,
    content: lastContent,
    directives: { ...globalDirectives, ...lastDirectives },
    startLine: currentStartLine,
    endLine: Math.max(currentStartLine, lines.length),
  });

  // Ensure at least 1 slide
  if (slides.length === 0) {
    slides.push({
      index: 0,
      raw: '',
      content: '',
      directives: globalDirectives,
      startLine: 1,
      endLine: 1,
    });
  }

  return {
    globalDirectives,
    slides,
  };
}

/**
 * Parses directive lines such as `theme: gaia`, `paginate: true`, `header: "My Deck"`
 */
export function parseDirectivesList(lines) {
  const directives = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim().replace(/^<!--\s*/, '');
      let val = trimmed.slice(colonIdx + 1).trim().replace(/\s*-->$/, '');

      // Boolean coercion
      if (val.toLowerCase() === 'true') val = true;
      else if (val.toLowerCase() === 'false') val = false;
      // Strip surrounding quotes
      else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      directives[key] = val;
    }
  }
  return directives;
}

/**
 * Extracts slide-specific directives comments: `<!-- _class: lead -->` or `<!-- paginate: true -->`
 */
export function parseSlideDirectives(rawSlideText) {
  const lines = rawSlideText.split(/\r?\n/);
  const directives = {};
  const cleanedLines = [];

  const directiveRegex = /<!--\s*(_?[a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*-->/;

  for (const line of lines) {
    const match = line.match(directiveRegex);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.toLowerCase() === 'true') val = true;
      else if (val.toLowerCase() === 'false') val = false;
      else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      directives[key] = val;
    } else {
      cleanedLines.push(line);
    }
  }

  return {
    content: cleanedLines.join('\n').trim(),
    directives,
  };
}

/**
 * Finds which slide index contains a given line number in the editor
 */
export function getSlideIndexForLine(slides, lineNumber) {
  if (!slides || slides.length === 0) return 0;
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (lineNumber >= slide.startLine && lineNumber <= slide.endLine) {
      return i;
    }
  }
  // If beyond last slide
  if (lineNumber > slides[slides.length - 1].endLine) {
    return slides.length - 1;
  }
  return 0;
}

export function splitFrontmatter(markdown = '') {
  if (!markdown.startsWith('---')) return { frontmatter: '', body: markdown };
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: markdown };
  const separatorEnd = end + 4;
  return {
    frontmatter: markdown.slice(0, separatorEnd),
    body: markdown.slice(separatorEnd),
  };
}

export function rebuildPresentationMarkdown(frontmatter, slides) {
  const body = slides.map((slide) => slide.raw.trim()).join('\n\n---\n\n');
  return frontmatter ? `${frontmatter}\n\n${body}` : body;
}
