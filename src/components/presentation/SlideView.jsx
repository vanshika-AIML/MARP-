/**
 * SlideView Component
 * Renders an individual MARP slide with full support for:
 * - MARP Themes: default, gaia, uncover
 * - Scoped Directives: _class (lead, invert), _backgroundColor, _color
 * - Global Directives: header, footer, paginate (slide number)
 * - Scalable aspect-ratio container (16:9)
 */
/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { getTheme } from '../../utils/themeRegistry';
import { api } from '../../services/api';

/**
 * Basic safe markdown-to-html compiler tailored for MARP slides
 */
const markdownRenderer = new MarkdownIt({ html: true, linkify: true, breaks: false });
const defaultLinkOpen = markdownRenderer.renderer.rules.link_open;
markdownRenderer.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('target', '_blank');
  tokens[index].attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen ? defaultLinkOpen(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
};
const defaultImage = markdownRenderer.renderer.rules.image;
markdownRenderer.renderer.rules.image = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const alt = renderer.renderInlineAsText(token.children || [], options, env);
  if (/^bg(?:\s|$)/.test(alt)) {
    const split = alt.match(/\b(right|left):(\d+(?:\.\d+)?)%/);
    const opacity = alt.match(/\bopacity:(0(?:\.\d+)?|1(?:\.0+)?)(?:\s|$)/);
    token.attrSet('class', split ? `marp-bg marp-bg-${split[1]}` : 'marp-bg');
    token.attrSet('style', `${split ? `width:${Math.min(80, Math.max(20, Number(split[2])))}%;` : ''}${opacity ? `opacity:${opacity[1]};` : ''}`);
  }
  return defaultImage(tokens, index, options, env, renderer);
};

export function renderSlideMarkdownToHtml(markdown = '') {
  return markdownRenderer.render(markdown);
}

export function sanitizeSlideHtml(html = '') {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'class'],
  });
}

export function resolveMediaUrls(markdown = '') {
  return markdown.replace(
    /(\]\()(\/api\/v1\/media\/[a-f0-9-]+\/file)(\))/gi,
    (_match, open, path, close) => `${open}${api.mediaUrl(path) || path}${close}`,
  );
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

export function SlideView({
  slide,
  theme = 'default',
  themeDefinition = null,
  scale = 1.0,
  className = '',
  style = {},
  showSlideNumber = true,
}) {
  const directives = slide?.directives || {};
  const currentTheme = directives.theme || theme || 'default';
  const themeTokens = themeDefinition || getTheme(currentTheme);
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
    return sanitizeSlideHtml(renderSlideMarkdownToHtml(resolveMediaUrls(slide?.content || '')));
  }, [slide?.content]);

  const slideWrapperClasses = [
    'marp-slide-wrapper slide-enter',
    `marp-theme-${currentTheme}`,
    slideClass.includes('lead') ? 'slide-lead' : '',
    slideClass.includes('invert') ? 'slide-invert' : '',
    `slide-layout-${layout}`,
    `slide-variant-${(slide?.index || 0) % 3}`,
    dense ? 'slide-dense' : '',
    slideClass.split(/\s+/).filter((name) => /^visual-(split|background|hero|framed|full-bleed)$/.test(name)).join(' '),
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
