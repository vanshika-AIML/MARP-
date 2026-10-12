import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { parseMarpPresentation } from '../../utils/marpParser';
import { configService } from '../../services/configService';
import { useMarpConfig } from '../../context/MarpConfigContext';
import SlideView from '../presentation/SlideView';

export default function UploadTemplate() {
  const { config, reload } = useMarpConfig();
  const [template, setTemplate] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const request = useRef(0);
  const readFile = async (file) => {
    if (!file) return;
    const current = ++request.current;
    setTemplate(null); setError(''); setSaved(false);
    if (!/\.(md|markdown)$/i.test(file.name)) { setError('Choose a MARP Markdown file (.md or .markdown).'); return; }
    if (file.size > 1024 * 1024) { setError('Please choose a template smaller than 1 MB.'); return; }
    setProcessing(true);
    try {
      const markdown = await file.text();
      if (current !== request.current) return;
      if (!markdown.trim()) throw new Error('This file is empty. Add some Markdown and try again.');
      const parsed = parseMarpPresentation(markdown);
      setTemplate({ title: file.name.replace(/\.(md|markdown)$/i, ''), markdown, theme: parsed.globalDirectives.theme || 'default', slides: parsed.slides });
    } catch (reason) { if (current === request.current) setError(reason.message || 'We could not read this file.'); }
    finally { if (current === request.current) setProcessing(false); }
  };
  const save = async (event) => {
    event.preventDefault();
    if (!template?.title.trim() || processing) return;
    setProcessing(true); setError('');
    try {
      await configService.createTemplate({ name: template.title.trim(), description: 'Uploaded MARP template', category: 'custom', theme_id: config.themes.find((theme) => theme.id === template.theme)?.backendId || null, starter_markdown: template.markdown, tags: ['custom'], is_active: true });
      await reload({ throwOnError: true }); setSaved(true);
    } catch (reason) { setError(reason.message || 'The template could not be saved.'); }
    finally { setProcessing(false); }
  };
  return <section className="upload-panel"><div className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!processing) readFile(event.dataTransfer.files[0]); }}>
    <UploadCloud size={38} /><h2>Bring your own starting point.</h2><p>Drop a MARP Markdown template here, or choose a file.<br />.md or .markdown · Up to 1 MB · Saved to your workspace</p>
    <label className="primary-cta upload-file">Choose Markdown file<input aria-label="Choose Markdown file" type="file" accept=".md,.markdown" disabled={processing} onChange={(event) => { readFile(event.target.files[0]); event.target.value = ''; }} /></label>
  </div>
    {processing && <div role="status" className="upload-processing"><FileText size={24} /><div>Saving your template<span className="processing-line" aria-hidden="true"><i /></span></div></div>}
    {error && <p role="alert" className="ui-error">{error}</p>}
    {template && <form onSubmit={save} className="upload-review"><div className="template-preview"><SlideView slide={template.slides[0]} theme={template.theme} /></div><div><label htmlFor="template-name">Template name</label><input id="template-name" value={template.title} disabled={saved || processing} onChange={(event) => setTemplate({ ...template, title: event.target.value })} /><p>{template.slides.length} slides · {template.theme} theme</p>{saved ? <p role="status" className="saved-message"><CheckCircle2 size={18} /> Saved. Find it in Explore Templates.</p> : <button type="submit" className="primary-cta" disabled={!template.title.trim() || processing}>Save template</button>}</div></form>}
  </section>;
}
