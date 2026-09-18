import React, { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import SlideView from '../presentation/SlideView';
import { parseMarpPresentation } from '../../utils/marpParser';
import { THEME_CATEGORIES } from '../../utils/themeRegistry';
import { THEME_TEMPLATES } from '../../utils/templateCatalog';
import { useMarpConfig } from '../../context/MarpConfigContext';

export default function TemplatesPanel({ customTemplates, onCreate }) {
  const { config } = useMarpConfig();
  const [category, setCategory] = useState('All');
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const templates = useMemo(() => [...customTemplates.map((item) => ({ ...item, category: 'Custom' })), ...config.templates.filter((item) => item.active).map((item) => ({ ...item, title: item.name })), ...THEME_TEMPLATES.filter((item) => config.themes.some((theme) => theme.id === item.theme && theme.active))], [customTemplates, config.templates, config.themes]);
  const create = async (template) => {
    setPending(template.id); setError('');
    try { await onCreate(template); } catch (err) { setError(err.message); } finally { setPending(null); }
  };
  return <section className="template-library" aria-label="Template library"><div className="template-filters" aria-label="Template categories">{['All', 'Starter', ...THEME_CATEGORIES, 'Custom'].map((item) => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    {error && <p role="alert" className="ui-error">{error}</p>}
    <div className="deck-grid">{templates.filter((item) => category === 'All' || item.category === category).map((item, index) => <button key={item.id} style={{ '--card-index': index % 12 }} disabled={pending !== null} onClick={() => create(item)} className="template-tile"><div className="template-preview"><SlideView slide={parseMarpPresentation(item.markdown).slides[0]} theme={item.theme} showSlideNumber={false} /></div><div className="template-caption"><div><h3>{item.title}</h3><p>{pending === item.id ? 'Creating your deck…' : item.category}</p></div><ArrowUpRight size={18} /></div></button>)}</div>
    {category === 'Custom' && !customTemplates.length && <p className="empty-state">Your own templates belong here. Choose Upload Custom Template to add a MARP Markdown file.</p>}
  </section>;
}
