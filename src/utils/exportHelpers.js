/** Presentation Export Helpers (HTML, Markdown, PDF print, and downloads) */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SlideView from '../components/presentation/SlideView';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function safeFilename(filename = 'presentation') {
  return filename.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'presentation';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getDocumentStyles() {
  return Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules, (rule) => rule.cssText);
    } catch {
      return [];
    }
  }).join('\n');
}

export function downloadMarkdownFile(filename, content) {
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${safeFilename(filename.replace(/\.md$/, ''))}.md`);
}

function createSlideHtml(slide, theme, index) {
  return `<section class="slide-page">${renderToStaticMarkup(createElement(SlideView, { slide: { ...slide, index }, theme }))}</section>`;
}

export function createPresentationHtml(title, slides, theme = 'default') {
  const slidesHtml = slides.map((slide, index) => createSlideHtml(slide, theme, index)).join('\n');
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || 'MARP Presentation')}</title>
  <style>
    ${getDocumentStyles().replace(/<\/style/gi, '&lt;/style')}
    @page { size: 13.333333in 7.5in; margin: 0; }
    .marp-slide-wrapper { width: 100%; height: 100%; animation: none !important; }
    body {
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 40px 20px;
      font-family: 'Inter', sans-serif;
    }
    .slide-page {
      width: min(960px, 100vw);
      aspect-ratio: 16 / 9;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
      border-radius: 8px;
      overflow: hidden;
      background: white;
      position: relative;
    }
    @media print {
      body {
        background: transparent;
        padding: 0;
        gap: 0;
      }
      .slide-page {
        width: 13.333333in;
        height: 7.5in;
        page-break-after: always;
        break-inside: avoid;
        print-color-adjust: exact;
        box-shadow: none;
        border-radius: 0;
      }
      .slide-page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;

  return fullHtml;
}

export function downloadHtmlPresentation(title, slides, theme = 'default') {
  downloadBlob(new Blob([createPresentationHtml(title, slides, theme)], { type: 'text/html;charset=utf-8' }), `${safeFilename(title)}.html`);
}

export function triggerPrintToPdf(title, slides, theme = 'default') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Allow pop-ups to print the presentation.');
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.addEventListener('load', async () => {
    await printWindow.document.fonts?.ready;
    await Promise.all(Array.from(printWindow.document.images, (img) => img.decode?.().catch(() => {})));
    printWindow.focus();
    printWindow.print();
  }, { once: true });
  printWindow.document.write(createPresentationHtml(title, slides, theme));
  printWindow.document.close();
}

export async function downloadExportResult(result, filename, format) {
  if (!result) throw new Error('The export service returned no file.');
  if (result instanceof Blob) {
    downloadBlob(result, `${safeFilename(filename)}.${format}`);
    return;
  }
  const downloadUrl = result.downloadUrl || result.url;
  if (!downloadUrl) throw new Error('The export service returned no download URL.');
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error('Unable to download the exported file.');
  downloadBlob(await response.blob(), `${safeFilename(filename)}.${format}`);
}
