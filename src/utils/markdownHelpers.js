/**
 * Markdown & MARP Directive Insertion Helpers
 */

export function insertMarkdownFormatting(view, type, payload = {}) {
  if (!view) return;

  const state = view.state;
  const selection = state.selection.main;
  const selectedText = state.sliceDoc(selection.from, selection.to);

  let replacement = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      replacement = `**${selectedText || 'bold text'}**`;
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case 'italic':
      replacement = `*${selectedText || 'italic text'}*`;
      cursorOffset = selectedText ? replacement.length : 1;
      break;
    case 'code':
      replacement = selectedText.includes('\n')
        ? `\`\`\`javascript\n${selectedText || '// Code here'}\n\`\`\``
        : `\`${selectedText || 'code'}\``;
      cursorOffset = replacement.length;
      break;
    case 'h1':
      replacement = `# ${selectedText || 'Heading 1'}`;
      cursorOffset = replacement.length;
      break;
    case 'h2':
      replacement = `## ${selectedText || 'Heading 2'}`;
      cursorOffset = replacement.length;
      break;
    case 'h3':
      replacement = `### ${selectedText || 'Heading 3'}`;
      cursorOffset = replacement.length;
      break;
    case 'ul':
      replacement = selectedText
        ? selectedText.split('\n').map((l) => `- ${l}`).join('\n')
        : '- List item';
      cursorOffset = replacement.length;
      break;
    case 'ol':
      replacement = selectedText
        ? selectedText.split('\n').map((l, idx) => `${idx + 1}. ${l}`).join('\n')
        : '1. List item';
      cursorOffset = replacement.length;
      break;
    case 'quote':
      replacement = selectedText
        ? selectedText.split('\n').map((l) => `> ${l}`).join('\n')
        : '> Quote text';
      cursorOffset = replacement.length;
      break;
    case 'link':
      replacement = `[${selectedText || 'link text'}](https://example.com)`;
      cursorOffset = replacement.length;
      break;
    case 'image':
      replacement = `![${selectedText || 'image alt'}](https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800)`;
      cursorOffset = replacement.length;
      break;
    case 'table':
      replacement = `| Header 1 | Header 2 | Header 3 |\n| :--- | :--- | :--- |\n| Cell 1 | Cell 2 | Cell 3 |\n| Data A | Data B | Data C |`;
      cursorOffset = replacement.length;
      break;
    case 'slide-break':
      replacement = `\n\n---\n\n## ${selectedText || 'New Slide Title'}\n\n- Point 1\n- Point 2\n`;
      cursorOffset = replacement.length;
      break;
    case 'directive-theme':
      replacement = `<!-- _class: ${payload.className || 'lead'} -->\n`;
      cursorOffset = replacement.length;
      break;
    case 'directive-bg':
      replacement = `<!-- _backgroundColor: ${payload.color || '#0f172a'} -->\n<!-- _color: #ffffff -->\n`;
      cursorOffset = replacement.length;
      break;
    case 'directive-header':
      replacement = `<!-- header: "${payload.header || 'MARP Squad Presentation'}" -->\n`;
      cursorOffset = replacement.length;
      break;
    case 'directive-footer':
      replacement = `<!-- footer: "${payload.footer || 'Confidential & Proprietary'}" -->\n`;
      cursorOffset = replacement.length;
      break;
    case 'directive-paginate':
      replacement = `<!-- paginate: true -->\n`;
      cursorOffset = replacement.length;
      break;
    default:
      return;
  }

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: replacement },
    selection: { anchor: selection.from + cursorOffset },
  });
  view.focus();
}

/**
 * Strips basic markdown for plain text word count and previews
 */
export function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/^---[\s\S]*?---/g, '') // remove frontmatter
    .replace(/<!--[\s\S]*?-->/g, '') // remove directives
    .replace(/#+\s+/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

export function countWordsAndChars(text) {
  const clean = stripMarkdown(text);
  const words = clean.split(/\s+/).filter(Boolean).length;
  const chars = clean.length;
  return { words, chars };
}
