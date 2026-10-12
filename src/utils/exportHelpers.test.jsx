import { afterEach, expect, it, vi } from 'vitest';
import { createPresentationHtml, triggerPrintToPdf } from './exportHelpers';
import { parseMarpPresentation } from './marpParser';

afterEach(() => vi.restoreAllMocks());

it('exports sanitized slides with the same theme tokens and real print pages', () => {
  const slides = parseMarpPresentation('---\nmarp: true\ntheme: midnight\nheader: "<img src=x onerror=alert(1)>"\n---\n# One\n<img src=x onerror="alert(1)">\n\n---\n# Two').slides;
  const html = createPresentationHtml('</title><script>alert(1)</script>', slides, 'midnight');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(doc.querySelectorAll('.slide-page')).toHaveLength(2);
  expect(doc.querySelector('script, [onerror]')).toBeNull();
  expect(doc.querySelector('.marp-slide-header').textContent).toContain('<img');
  expect(doc.querySelector('.marp-slide-wrapper').style.getPropertyValue('--theme-background')).toBe('#0f172a');
  expect(html).toContain('@page');
});

it('keeps a usable print-window handle and detaches the opener', async () => {
  let loaded;
  const popup = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), images: [] }, focus: vi.fn(), print: vi.fn(), addEventListener: vi.fn((_, callback) => { loaded = callback; }) };
  vi.spyOn(window, 'open').mockReturnValue(popup);
  triggerPrintToPdf('Deck', [{ content: '# Test' }]);
  expect(window.open).toHaveBeenCalledWith('', '_blank');
  expect(popup.opener).toBeNull();
  await loaded();
  expect(popup.print).toHaveBeenCalledOnce();
});
