import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SlideView, { sanitizeSlideHtml } from './SlideView';

describe('SlideView sanitization', () => {
  it('removes executable HTML while keeping presentation content', () => {
    const html = sanitizeSlideHtml('<h1>Title</h1><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">Click</a><div onclick="alert(1)">test</div>');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
  });

  it('renders sanitized slide content', () => {
    render(<SlideView slide={{ content: '# Safe' }} />);
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });
});

it('preserves Markdown-like text inside code fences', () => {
  const { container } = render(<SlideView slide={{ content: '## Example\n\n```md\n# Not a heading\n- Not a list\n**Not bold**\n<div>&text</div>\n```' }} />);
  const code = container.querySelector('pre code');
  expect(code.textContent).toContain('# Not a heading\n- Not a list\n**Not bold**\n<div>&text</div>');
  expect(code.querySelector('h1,li,strong,p')).toBeNull();
});
it('honors an explicit slide composition without changing content', () => {
  const { container } = render(<SlideView slide={{ content: '## Two ideas\n- One\n- Two', directives: { _class: 'columns' } }} theme="editorial" />);
  expect(container.querySelector('.marp-theme-editorial.slide-layout-columns')).toBeInTheDocument();
});
