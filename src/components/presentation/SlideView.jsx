/**
 * SlideView Component
 * Renders an individual MARP slide with full support for:
 * - MARP Themes: default, gaia, uncover
 * - Scoped Directives: _class (lead, invert), _backgroundColor, _color
 * - Global Directives: header, footer, paginate (slide number)
 * - Scalable aspect-ratio container (16:9)
 */
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { getTheme } from '../../utils/themeRegistry';

/**
 * Basic safe markdown-to-html compiler tailored for MARP slides
 */
export function renderSlideMarkdownToHtml(markdown = '') {
  if (!markdown) return '';

  let html = markdown;

  // Escape basic script injections
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Protect fenced code from the following Markdown substitutions.
  const codeBlocks = [];
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    codeBlocks.push(`<pre><code class="language-${lang}">${escaped}</code></pre>`);
    return `\uE000CODE${codeBlocks.length - 1}\uE001`;
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
      !trimmed.startsWith('\uE000CODE') &&
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

  return finalized.join('\n').replace(/\uE000CODE(\d+)\uE001/g, (_match, index) => codeBlocks[Number(index)] || '');
}

export function sanitizeSlideHtml(html = '') {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'class'],
  });
}

function getSlideLayout(content = '') {
  const trimmed = content.trim();
  const lineCount = trimmed.split(/\r?\n/).filter(Boolean).length;
  if (/^#\s/.test(trimmed) && lineCount <= 4) return 'title';
  if (/^>\s/m.test(trimmed)) return 'quote';
  if (/```/.test(trimmed)) return 'code';
  if (/^\|.*\|$/m.test(trimmed)) return 'data';
  if (/!\[.*?\]\(/.test(trimmed)) return 'image';
  if (/(?:^|\s)(?:\d{2,3}%|\$?\d+(?:\.\d+)?x|\d{1,3}(?:,\d{3})+)(?:\s|$)/m.test(trimmed)) return 'stats';
  if (/^##\s/m.test(trimmed) && lineCount <= 3) return 'section';
  if (/^(?:- |\d+\. )/m.test(trimmed)) return 'list';
  return 'editorial';
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
  const themeTokens = getTheme(currentTheme);
  const slideClass = directives._class || directives.class || '';
  const backgroundColor = directives._backgroundColor || directives.backgroundColor;
  const color = directives._color || directives.color;
  const header = directives.header;
  const footer = directives.footer;
  const paginate = directives.paginate !== false;
  const slideIndex = (slide?.index ?? 0) + 1;
  const explicitLayout = slideClass.split(/\s+/).find((name) => ['title', 'section', 'quote', 'code', 'data', 'image', 'stats', 'list', 'editorial', 'columns'].includes(name));
  const layout = explicitLayout || getSlideLayout(slide?.content || '');
  const dense = (slide?.content || '').length > 1100 || (slide?.content || '').split('\n').filter(Boolean).length > 16;

  const renderedHtml = useMemo(() => {
    return sanitizeSlideHtml(renderSlideMarkdownToHtml(slide?.content || ''));
  }, [slide?.content]);

  const slideWrapperClasses = [
    'marp-slide-wrapper slide-enter',
    `marp-theme-${currentTheme}`,
    slideClass.includes('lead') ? 'slide-lead' : '',
    slideClass.includes('invert') ? 'slide-invert' : '',
    `slide-layout-${layout}`,
    `slide-variant-${(slide?.index || 0) % 3}`,
    dense ? 'slide-dense' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const customStyles = {
    '--theme-background': themeTokens.colors.background,
    '--theme-surface': themeTokens.colors.surface,
    '--theme-primary': themeTokens.colors.primary,
    '--theme-secondary': themeTokens.colors.secondary,
    '--theme-accent': themeTokens.colors.accent,
    '--theme-text': themeTokens.colors.text,
    '--theme-muted': themeTokens.colors.muted,
    '--theme-heading-font': themeTokens.fonts.heading,
    '--theme-body-font': themeTokens.fonts.body,
    '--theme-radius': themeTokens.radius,
    '--theme-shadow': themeTokens.shadows,
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
