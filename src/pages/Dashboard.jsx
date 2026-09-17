import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Copy, Layers3, Plus, Presentation, Search, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SlideView from '../components/presentation/SlideView';
import { parseMarpPresentation } from '../utils/marpParser';
import { STARTER_TEMPLATES } from '../utils/mockData';
import { presentationService } from '../services/presentationService';
import { agentService } from '../services/agentService';
import { THEME_CATEGORIES, THEME_REGISTRY } from '../utils/themeRegistry';

const steps = [
  ['01', 'Bring the idea', 'Start with a prompt, outline, or rough Markdown.'],
  ['02', 'Let AI shape it', 'Generate a clear story with useful slide hierarchy.'],
  ['03', 'Make it yours', 'Apply a visual system and refine every detail.'],
  ['04', 'Present with confidence', 'Export or present the finished deck anywhere.'],
];

function getTemplateCategory(theme) {
  if (theme === 'default') return 'Technical';
  if (theme === 'gaia') return 'Business';
  return 'Minimal';
}

function getHeroCardClass(index) {
  if (index === 1) return '-translate-y-6 z-10';
  if (index === 2) return 'translate-x-2 rotate-2';
  return '-rotate-2';
}

export function Dashboard({ onOpenDeck, onNewDeckWithTemplate }) {
  const [presentations, setPresentations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDecks = async () => {
    setIsLoading(true);
    try {
      setError(null);
      setPresentations(await presentationService.listPresentations());
    } catch (err) {
      setError(err.message || 'Unable to load presentations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDecks(); }, []);

  const filteredDecks = useMemo(() => presentations.filter((deck) =>
    deck.title?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [presentations, searchQuery]);

  const templates = STARTER_TEMPLATES.map((template) => ({
    ...template,
    category: getTemplateCategory(template.theme),
  })).filter((template) => category === 'All' || template.category === category);

  const createFromPrompt = async () => {
    const title = prompt.trim() || 'AI Presentation';
    const result = await agentService.generateContent(prompt.trim() || title);
    const markdown = result?.generatedMarkdown || STARTER_TEMPLATES[1].markdown;
    await onNewDeckWithTemplate({ title, theme: 'executive', markdown, description: 'AI-created presentation' });
  };

  const handleDelete = async (event, id) => {
    event.stopPropagation();
    if (window.confirm('Delete this presentation?')) {
      await presentationService.deletePresentation(id);
      fetchDecks();
    }
  };

  const handleDuplicate = async (event, deck) => {
    event.stopPropagation();
    await presentationService.createPresentation({ title: `${deck.title} (Copy)`, theme: deck.theme, markdown: deck.markdown });
    fetchDecks();
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <header className="sticky top-0 z-20 h-14 border-b border-slate-200/80 bg-white/90 backdrop-blur flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2 font-bold tracking-tight"><span className="grid place-items-center w-7 h-7 rounded-lg bg-sky-600 text-white"><Presentation className="w-4 h-4" /></span>MARP Studio</div>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => onNewDeckWithTemplate(null)}>Create Presentation</Button>
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-12 pb-20">
        <section className="relative py-20 md:py-28 text-center overflow-hidden">
          <div className="absolute left-1/2 top-20 -translate-x-1/2 w-72 h-72 bg-sky-200/30 blur-3xl rounded-full" />
          <p className="relative text-xs font-bold tracking-[.24em] uppercase text-sky-700 mb-5">The presentation workspace for ambitious ideas</p>
          <h1 className="relative max-w-4xl mx-auto text-5xl md:text-7xl font-bold tracking-[-.055em] leading-[.96]">Turn a thought into a deck people remember.</h1>
          <p className="relative max-w-xl mx-auto mt-6 text-base md:text-lg text-slate-500">MARP Studio brings AI direction, visual design, and Markdown control into one calm workspace.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3"><Button variant="primary" size="md" icon={Sparkles} onClick={() => onNewDeckWithTemplate(null)}>Create Presentation</Button><Button variant="outline" size="md" icon={Layers3} onClick={() => document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' })}>Explore Templates</Button></div>
          <div className="relative mt-16 flex justify-center opacity-90">{[THEME_REGISTRY[0], THEME_REGISTRY[8], THEME_REGISTRY[15]].map((theme, index) => <div key={theme.id} className={`w-44 md:w-64 aspect-video bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden ${getHeroCardClass(index)}`}><div className="h-full p-5" style={{ background: theme.colors.background, color: theme.colors.text }}><div className="w-1/2 h-2 rounded bg-current opacity-70 mb-5" /><div className="w-4/5 h-6 rounded bg-current opacity-90" /><div className="mt-3 w-3/5 h-2 rounded bg-current opacity-40" /></div></div>)}</div>
        </section>

        <section className="py-12 border-y border-slate-200/80"><div className="flex items-end justify-between mb-7"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-700">A better starting point</p><h2 className="text-2xl md:text-3xl font-bold mt-2">From blank page to clear story.</h2></div><WandSparkles className="w-7 h-7 text-sky-500" /></div><div className="grid md:grid-cols-4 gap-3">{steps.map(([number, title, description]) => <div key={number} className="p-5 bg-white border border-slate-200 rounded-xl hover:-translate-y-1 transition-transform"><span className="text-xs font-mono text-sky-600">{number}</span><h3 className="font-semibold mt-8">{title}</h3><p className="text-sm text-slate-500 mt-2 leading-relaxed">{description}</p></div>)}</div></section>

        <section className="py-14"><div className="rounded-2xl bg-slate-900 text-white p-7 md:p-10 grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-300">Create new presentation</p><h2 className="text-3xl font-bold mt-3">Give your idea a direction.</h2><p className="text-slate-400 mt-3 max-w-md">Start blank, choose a visual system, or ask the agent to build a first draft.</p></div><div className="bg-white/10 border border-white/10 rounded-xl p-4"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should your presentation make clear?" className="w-full min-h-24 bg-transparent resize-none outline-none text-sm placeholder:text-slate-500" /><div className="flex flex-wrap gap-2 pt-3 border-t border-white/10"><Button variant="primary" size="sm" icon={Sparkles} onClick={createFromPrompt}>Generate with AI</Button><Button variant="ghost" size="sm" onClick={() => onNewDeckWithTemplate(null)} className="text-white hover:bg-white/10">Start blank</Button></div></div></div></section>

        <section id="templates" className="space-y-5"><div className="flex flex-col md:flex-row md:items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-700">Template gallery</p><h2 className="text-3xl font-bold mt-2">A visual head start.</h2></div><div className="flex gap-1.5 flex-wrap">{['All', ...THEME_CATEGORIES].map((item) => <button key={item} onClick={() => setCategory(item)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${category === item ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{item}</button>)}</div></div><div className="grid md:grid-cols-3 gap-5">{templates.map((template) => { const firstSlide = parseMarpPresentation(template.markdown).slides[0]; return <Card key={template.id} hoverable onClick={() => onNewDeckWithTemplate(template)} className="overflow-hidden group"><div className="aspect-video bg-slate-100 overflow-hidden"><SlideView slide={firstSlide} theme={template.theme} showSlideNumber={false} /></div><div className="p-5"><div className="flex justify-between gap-3"><h3 className="font-semibold group-hover:text-sky-700">{template.title}</h3><Badge size="xs">{template.category}</Badge></div><p className="text-sm text-slate-500 mt-2 line-clamp-2">{template.description}</p><div className="mt-5 flex items-center gap-1 text-sm font-semibold text-sky-700">Use template <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div></div></Card>; })}</div></section>

        <section className="pt-16 space-y-5"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-700">Your workspace</p><h2 className="text-3xl font-bold mt-2">Recent presentations.</h2></div><div className="w-full sm:w-64"><Input placeholder="Search presentations" icon={Search} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div></div>{error ? <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div> : isLoading ? <div className="p-12 text-center text-sm text-slate-400">Loading presentations...</div> : filteredDecks.length === 0 ? <div className="p-12 bg-white border border-dashed border-slate-300 rounded-xl text-center"><Presentation className="w-8 h-8 text-slate-300 mx-auto" /><p className="text-sm text-slate-500 mt-3">Your next great deck starts here.</p></div> : <div className="grid md:grid-cols-3 gap-5">{filteredDecks.map((deck) => { const parsed = parseMarpPresentation(deck.markdown); return <Card key={deck.id} hoverable onClick={() => onOpenDeck(deck.id)} className="overflow-hidden"><div className="aspect-video bg-slate-100 overflow-hidden"><SlideView slide={parsed.slides[0]} theme={deck.theme} showSlideNumber={false} /></div><div className="p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold truncate">{deck.title}</h3><Badge size="xs" variant="blue">{parsed.slides.length}</Badge></div><div className="flex items-center gap-1 text-xs text-slate-400 mt-2"><Clock3 className="w-3 h-3" />{deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString() : 'Recently edited'}</div><div className="flex justify-end gap-1 mt-3"><button title="Duplicate" onClick={(event) => handleDuplicate(event, deck)} className="p-2 text-slate-400 hover:text-sky-600"><Copy className="w-4 h-4" /></button><button title="Delete" onClick={(event) => handleDelete(event, deck.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></div></div></Card>; })}</div>}</section>
      </div>
    </main>
  );
}

export default Dashboard;
