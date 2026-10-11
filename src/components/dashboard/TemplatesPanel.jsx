import React, { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import SlideView from '../presentation/SlideView';
import { parseMarpPresentation } from '../../utils/marpParser';
import { useMarpConfig } from '../../context/MarpConfigContext';

export default function TemplatesPanel({ onCreate }) {
  const { config, loading, error, reload } = useMarpConfig();
  const [category, setCategory] = useState('All');
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState('');
  const templates = useMemo(() => config.templates.filter((item) => item.active), [config.templates]);
  const categories = ['All', ...new Set(templates.map((item) => item.category))];
  const create = async (template) => {
    setPending(template.id); setActionError('');
    try { await onCreate(template); } catch (reason) { setActionError(reason.message); } finally { setPending(null); }
  };
  if (loading) return <p role="status" className="empty-state">Loading templates…</p>;
  return <section className="template-library" aria-label="Template library">
    <div className="template-filters" aria-label="Template categories">{categories.map((item) => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    {(error || actionError) && <p role="alert" className="ui-error">{error || actionError} <button onClick={reload}>Try again</button></p>}
    <div className="deck-grid">{templates.filter((item) => category === 'All' || item.category === category).map((item, index) => <button key={item.id} style={{ '--card-index': index % 12 }} disabled={pending !== null} onClick={() => create(item)} className="template-tile"><div className="template-preview"><SlideView slide={parseMarpPresentation(item.markdown).slides[0]} theme={item.theme} showSlideNumber={false} /></div><div className="template-caption"><div><h3>{item.title}</h3><p>{pending === item.id ? 'Creating your deck…' : item.category}</p></div><ArrowUpRight size={18} /></div></button>)}</div>
    {!templates.length && !error && <p className="empty-state">No templates are published yet. An administrator can add one in MARP Admin.</p>}
  </section>;
}
