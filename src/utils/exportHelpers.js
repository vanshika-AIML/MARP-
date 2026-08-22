/**
 * Presentation Export Helpers (HTML, Markdown, PDF print)
 */

export function downloadMarkdownFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename.replace(/\.md$/, '')}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadHtmlPresentation(title, slidesHtml, theme = 'default') {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'MARP Presentation'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
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
      width: 960px;
      height: 540px;
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
        width: 100vw;
        height: 100vh;
        page-break-after: always;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${(title || 'presentation').toLowerCase().replace(/\s+/g, '-')}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function triggerPrintToPdf() {
  window.print();
}
