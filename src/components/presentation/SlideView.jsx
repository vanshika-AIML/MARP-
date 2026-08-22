/**
 * SlideView Component
 * Renders an individual MARP slide with full support for:
 * - MARP Themes: default, gaia, uncover
 * - Scoped Directives: _class (lead, invert), _backgroundColor, _color
 * - Global Directives: header, footer, paginate (slide number)
 * - Scalable aspect-ratio container (16:9)
 */
import React, { useMemo } from 'react';

/**
 * Basic safe markdown-to-html compiler tailored for MARP slides
 */
function renderSlideMarkdownToHtml(markdown = '') {
  if (!markdown) return '';

  let html = markdown;

  // Escape basic script injections
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Code blocks (triple backticks)
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Images
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="max-h-48 rounded object-contain my-2" />');

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-600 underline">$1</a>');

  // Tables
  const lines = html.split('\n');
  const processedLines = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
    } else {
      if (inTable) {
        processedLines.push(convertTableRowsToHtml(tableRows));
        inTable = false;
        tableRows = [];
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable) {
    processedLines.push(convertTableRowsToHtml(tableRows));
  }
  html = processedLines.join('\n');

  // Bullet Lists
  html = html.replace(/(?:^-\s+(.+)(?:\n|$))+/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map((item) => `<li>${item.replace(/^-\s+/, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Numbered Lists
  html = html.replace(/(?:^\d+\.\s+(.+)(?:\n|$))+/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map((item) => `<li>${item.replace(/^\d+\.\s+/, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs (wrap standalone non-tag lines)
  const paragraphLines = html.split('\n');
  const finalized = [];
  for (const line of paragraphLines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith('<h') &&
      !trimmed.startsWith('<ul') &&
      !trimmed.startsWith('<ol') &&
      !trimmed.startsWith('<li') &&
      !trimmed.startsWith('<pre') &&
      !trimmed.startsWith('<blockquote') &&
      !trimmed.startsWith('<table') &&
      !trimmed.startsWith('<img') &&
      !trimmed.startsWith('<!--')
    ) {
      finalized.push(`<p>${trimmed}</p>`);
    } else {
      finalized.push(line);
    }
  }

  return finalized.join('\n');
}

function convertTableRowsToHtml(rows) {
  if (rows.length < 2) return rows.join('\n');
  const headerRow = rows[0];
  const isSeparator = rows[1].includes('---');
  const dataRows = isSeparator ? rows.slice(2) : rows.slice(1);

  const headers = headerRow
    .split('|')
    .slice(1, -1)
    .map((c) => `<th>${c.trim()}</th>`)
    .join('');

  const body = dataRows
    .map((r) => {
      const cells = r
        .split('|')
        .slice(1, -1)
        .map((c) => `<td>${c.trim()}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
}

export function SlideView({
  slide,
  theme = 'default',
  scale = 1.0,
  className = '',
  style = {},
  showSlideNumber = true,
}) {
  const directives = slide?.directives || {};
  const currentTheme = directives.theme || theme || 'default';
  const slideClass = directives._class || directives.class || '';
  const backgroundColor = directives._backgroundColor || directives.backgroundColor;
  const color = directives._color || directives.color;
  const header = directives.header;
  const footer = directives.footer;
  const paginate = directives.paginate !== false;
  const slideIndex = (slide?.index ?? 0) + 1;

  const renderedHtml = useMemo(() => {
    return renderSlideMarkdownToHtml(slide?.content || '');
  }, [slide?.content]);

  const slideWrapperClasses = [
    'marp-slide-wrapper',
    `marp-theme-${currentTheme}`,
    slideClass.includes('lead') ? 'slide-lead' : '',
    slideClass.includes('invert') ? 'slide-invert' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const customStyles = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(color ? { color } : {}),
    ...style,
  };

  return (
    <div className={slideWrapperClasses} style={customStyles}>
      {/* Header Directive */}
      {header && <div className="marp-slide-header">{header}</div>}

      {/* Main Slide Content */}
      <div
        className="marp-slide-content"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Footer & Pagination Directives */}
      {(footer || (paginate && showSlideNumber)) && (
        <div className="marp-slide-footer">
          <div>{footer || ''}</div>
          {paginate && showSlideNumber && (
            <div className="marp-slide-pagenum">{slideIndex}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SlideView;
