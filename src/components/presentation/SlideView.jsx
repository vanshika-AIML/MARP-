/**
 * SlideView Component
 * Renders an individual MARP slide with full support for:
 * - MARP Themes: default, gaia, uncover
 * - Scoped Directives: _class (lead, invert), _backgroundColor, _color
 * - Global Directives: header, footer, paginate (slide number)
 * - Scalable aspect-ratio container (16:9)
 */
import React, { useMemo } from 'react';
import { getTheme } from '../../utils/themeRegistry';

/**
 * Markdown-to-HTML compiler with INLINE VANILLA CSS for presentation-ready slides.
 * Accepts themeTokens so every element gets the correct colors baked in.
 */
export function renderSlideMarkdownToHtml(markdown = '', themeTokens = null) {
  const empty = { html: '', bgImage: null, splitLayout: null, splitSize: '50%' };
  if (!markdown) return empty;

  // Default fallback tokens
  const t = themeTokens?.colors || {
    background: '#ffffff', surface: '#f8fafc', primary: '#0369a1',
    secondary: '#475569', accent: '#0284c7', text: '#0f172a', muted: '#64748b',
  };
  const fonts = themeTokens?.fonts || { heading: 'Inter', body: 'Inter' };

  let html = markdown;
  let bgImage = null;
  let splitLayout = null;
  let splitSize = '50%';

  // Extract MARP bg images
  html = html.replace(/!\[bg(?: (left|right)(?::(\d+%))?)?\]\((.*?)\)/gi, (match, pos, size, url) => {
    bgImage = url;
    if (pos) {
      splitLayout = pos.toLowerCase();
      if (size) splitSize = size;
    }
    return '';
  });

  // Strip script injections
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Code blocks
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre style="background:${t.surface};border-radius:10px;padding:1.2rem 1.5rem;font-family:'JetBrains Mono',monospace;font-size:0.85rem;border:1px solid ${t.muted}30;overflow-x:auto;margin:0.8rem 0;color:${t.text}"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, `<code style="background:${t.surface};padding:0.15em 0.4em;border-radius:4px;font-size:0.88em;font-family:'JetBrains Mono',monospace;color:${t.primary}">$1</code>`);

  // Headings with inline styles
  html = html.replace(/^### (.*$)/gim, `<h3 style="color:${t.secondary};font-family:'${fonts.heading}',system-ui,sans-serif;font-weight:600;font-size:1.3rem;margin:0.6em 0 0.3em">$1</h3>`);
  html = html.replace(/^## (.*$)/gim, `<h2 style="color:${t.text};font-family:'${fonts.heading}',system-ui,sans-serif;font-weight:700;font-size:1.7rem;margin:0.5em 0 0.4em">$1</h2>`);
  html = html.replace(/^# (.*$)/gim, `<h1 style="color:${t.primary};font-family:'${fonts.heading}',system-ui,sans-serif;font-weight:800;font-size:2.6rem;letter-spacing:-0.02em;line-height:1.1;margin:0 0 0.4em">$1</h1>`);

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, `<blockquote style="border-left:4px solid ${t.accent};padding:0.6rem 1.2rem;margin:1rem 0;font-style:italic;color:${t.secondary};font-size:1.15rem;font-weight:500;background:${t.surface}40;border-radius:0 8px 8px 0">$1</blockquote>`);

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="font-weight:700;color:${t.text}">$1</strong>`);
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/__([^_]+)__/g, `<strong style="font-weight:700;color:${t.text}">$1</strong>`);
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Images (non-bg)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, `<img src="$2" alt="$1" style="max-height:300px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.12);display:block;margin:0.8rem auto;object-fit:contain" />`);

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer" style="color:${t.accent};text-decoration:underline">$1</a>`);

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
        processedLines.push(convertTableRowsToHtml(tableRows, t));
        inTable = false;
        tableRows = [];
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable) {
    processedLines.push(convertTableRowsToHtml(tableRows, t));
  }
  html = processedLines.join('\n');

  // Bullet Lists
  html = html.replace(/(?:^- (.+)(?:\n|$))+/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map((item) => `<li style="color:${t.text};font-size:1.05rem;line-height:1.6;margin-bottom:0.35em;font-family:'${fonts.body}',system-ui,sans-serif">${item.replace(/^- /, '')}</li>`)
      .join('');
    return `<ul style="list-style-type:disc;padding-left:1.5rem;margin:0.5rem 0">${items}</ul>`;
  });

  // Numbered Lists
  html = html.replace(/(?:^\d+\. (.+)(?:\n|$))+/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map((item) => `<li style="color:${t.text};font-size:1.05rem;line-height:1.6;margin-bottom:0.35em;font-family:'${fonts.body}',system-ui,sans-serif">${item.replace(/^\d+\.\s+/, '')}</li>`)
      .join('');
    return `<ol style="list-style-type:decimal;padding-left:1.5rem;margin:0.5rem 0">${items}</ol>`;
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
      finalized.push(`<p style="color:${t.secondary};font-size:1.05rem;line-height:1.6;margin-bottom:0.5em;font-family:'${fonts.body}',system-ui,sans-serif">${trimmed}</p>`);
    } else {
      finalized.push(line);
    }
  }

  return { 
    html: finalized.join('\n'),
    bgImage,
    splitLayout,
    splitSize
  };
}

function convertTableRowsToHtml(rows, t = {}) {
  if (rows.length < 2) return rows.join('\n');
  const headerRow = rows[0];
  const isSeparator = rows[1].includes('---');
  const dataRows = isSeparator ? rows.slice(2) : rows.slice(1);

  const thStyle = `style="padding:0.6rem 1rem;text-align:left;font-weight:700;font-size:0.9rem;color:${t.text || '#0f172a'};border-bottom:2px solid ${t.primary || '#0369a1'}30"`;
  const tdStyle = `style="padding:0.5rem 1rem;font-size:0.9rem;color:${t.secondary || '#475569'};border-bottom:1px solid ${t.muted || '#e2e8f0'}30"`;

  const headers = headerRow
    .split('|')
    .slice(1, -1)
    .map((c) => `<th ${thStyle}>${c.trim()}</th>`)
    .join('');

  const body = dataRows
    .map((r) => {
      const cells = r
        .split('|')
        .slice(1, -1)
        .map((c) => `<td ${tdStyle}>${c.trim()}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table style="width:100%;border-collapse:collapse;margin:1rem 0;border-radius:8px;overflow:hidden"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
}

export function SlideView({
  slide,
  theme = 'default',
  scale = 1.0,
  className = '',
  style = {},
  showSlideNumber = true,
}) {
  const { content, directives = {} } = slide || {};
  const currentTheme = directives.theme || theme || 'default';
  const themeTokens = getTheme(currentTheme);
  const slideClass = String(directives._class || directives.class || '');
  const backgroundColor = directives._backgroundColor || directives.backgroundColor;
  const color = directives._color || directives.color;
  const header = directives.header;
  const footer = directives.footer;
  const paginate = directives.paginate !== false;
  const slideIndex = (slide?.index ?? 0) + 1;

  const { html: renderedHtml, bgImage, splitLayout, splitSize } = useMemo(() => {
    return renderSlideMarkdownToHtml(content || slide?.content || '', themeTokens);
  }, [content, slide?.content, themeTokens]);

  const slideWrapperClasses = [
    'marp-slide-wrapper',
    `marp-theme-${currentTheme}`,
    splitLayout ? 'marp-split-layout' : '',
    slideClass.includes('lead') ? 'slide-lead' : '',
    slideClass.includes('invert') ? 'slide-invert' : '',
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

  const contentWrapperStyle = {};
  const bgWrapperStyle = {};

  if (splitLayout) {
    if (splitLayout === 'right') {
      contentWrapperStyle.width = `calc(100% - ${splitSize})`;
      bgWrapperStyle.width = splitSize;
      bgWrapperStyle.right = 0;
    } else {
      contentWrapperStyle.width = `calc(100% - ${splitSize})`;
      contentWrapperStyle.marginLeft = splitSize;
      bgWrapperStyle.width = splitSize;
      bgWrapperStyle.left = 0;
    }
  } else if (bgImage) {
    customStyles.backgroundImage = `url('${bgImage}')`;
    customStyles.backgroundSize = 'cover';
    customStyles.backgroundPosition = 'center';
  }

  return (
    <div className={slideWrapperClasses} style={customStyles}>
      {/* Header Directive */}
      {header && <div className="marp-slide-header">{header}</div>}

      {/* Split Background Image Element */}
      {splitLayout && bgImage && (
        <div 
          className="marp-split-bg" 
          style={{ ...bgWrapperStyle, backgroundImage: `url('${bgImage}')` }} 
        />
      )}

      {/* Main Slide Content */}
      <div
        className="marp-slide-content"
        style={contentWrapperStyle}
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
