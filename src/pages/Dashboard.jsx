import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Copy, Layers3, Play, Plus, Presentation, Search, Sparkles, Trash2 } from 'lucide-react';
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
  { icon: '💡', title: 'Describe your idea', desc: 'Start with a topic, prompt, or rough outline. Our AI understands your intent.' },
  { icon: '✨', title: 'AI designs it', desc: 'Generates structured slides with beautiful layouts, images, and typography.' },
  { icon: '🎨', title: 'Make it yours', desc: 'Choose from 15+ themes, edit content, and fine-tune every detail.' },
  { icon: '🚀', title: 'Present anywhere', desc: 'Export to PDF, share a link, or present directly from the browser.' },
];

function getTemplateCategory(theme) {
  if (theme === 'default') return 'Technical';
  if (theme === 'gaia') return 'Business';
  return 'Minimal';
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
    const markdown = result?.markdown || result?.generatedMarkdown || STARTER_TEMPLATES[1].markdown;
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
    <main className="flex-1 overflow-y-auto bg-white text-slate-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ────── Navigation Bar ────── */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <Presentation className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">MARP Studio</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
              <button className="hover:text-slate-900 transition-colors">Templates</button>
              <button className="hover:text-slate-900 transition-colors">Themes</button>
              <button className="hover:text-slate-900 transition-colors">About</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" icon={Plus} onClick={() => onNewDeckWithTemplate(null)}>
              Start for free
            </Button>
          </div>
        </div>
      </nav>

      {/* ────── Hero Section ────── */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-8 md:pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Powered by AI</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.08] text-slate-900">
                Effortless AI design for{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  presentations
                </span>
              </h1>

              <p className="mt-6 text-lg text-slate-500 leading-relaxed max-w-lg">
                Your ideas are brilliant. The universe deserves to see them. A captivating pitch deck? Easy. 
                A stunning presentation? Done. Make anything you can imagine almost as quickly as you can think it up.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" icon={Sparkles} onClick={() => onNewDeckWithTemplate(null)}
                  className="!rounded-full !px-7 !py-3 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow">
                  Start for free
                </Button>
                <button className="flex items-center gap-2 px-5 py-3 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  <Play className="w-4 h-4" /> Watch video
                </button>
              </div>
            </div>

            {/* Right: Floating Slide Mockups */}
            <div className="relative hidden lg:block">
              <div className="absolute -top-8 -right-8 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-violet-100/40 rounded-full blur-3xl" />

              <div className="relative">
                {/* Top card - tilted */}
                <div className="absolute -top-4 right-0 w-[340px] rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/40 border border-slate-200/60 transform rotate-2 hover:rotate-0 transition-transform duration-500 z-10">
                  <img src="/hero-slide-1.png" alt="Presentation mockup" className="w-full" />
                </div>

                {/* Main card */}
                <div className="relative mt-16 ml-4 w-[380px] rounded-2xl overflow-hidden shadow-2xl shadow-blue-300/30 border border-blue-100 z-20 hover:scale-[1.02] transition-transform duration-500">
                  <img src="/hero-slide-2.png" alt="Presentation mockup" className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Soft gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </section>

      {/* ────── How it Works ────── */}
      <section className="py-20 md:py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 tracking-wide uppercase mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              From idea to stunning deck in minutes
            </h2>
            <p className="mt-4 text-slate-500 max-w-lg mx-auto">
              No design skills needed. Just describe what you want and let the AI handle the rest.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i}
                className="group relative p-7 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-3xl mb-5">{step.icon}</div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                <div className="absolute top-6 right-6 text-4xl font-black text-slate-100 select-none">
                  {String(i + 1).padStart(2, '0')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────── AI Prompt Section ────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-10 md:p-16">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

            <div className="relative grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-sm font-semibold text-blue-200 tracking-wide uppercase mb-3">Create with AI</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  Give your idea a direction
                </h2>
                <p className="mt-4 text-blue-100/80 max-w-md leading-relaxed">
                  Describe your topic and our AI will generate a beautifully structured presentation with rich layouts, images, and dynamic typography.
                </p>
              </div>
              <div className="relative bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What should your presentation be about?"
                  className="w-full min-h-[120px] bg-white/10 text-white placeholder:text-blue-200/50 border border-white/15 rounded-xl p-4 text-sm resize-none outline-none focus:ring-2 focus:ring-white/30 transition-all"
                />
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button variant="secondary" size="md" icon={Sparkles} onClick={createFromPrompt}
                    className="!bg-white !text-indigo-700 hover:!bg-blue-50 !font-bold !shadow-lg">
                    Generate with AI
                  </Button>
                  <Button variant="outline" size="md" onClick={() => onNewDeckWithTemplate(null)}
                    className="!border-white/30 !text-white hover:!bg-white/10">
                    Start blank
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────── Templates Gallery ────── */}
      <section id="templates" className="py-20 md:py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-sm font-semibold text-blue-600 tracking-wide uppercase mb-3">Templates</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                A beautiful head start
              </h2>
              <p className="mt-3 text-slate-500 max-w-md">
                Choose from professionally designed templates and customize them to match your vision.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['All', ...THEME_CATEGORIES].map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all duration-200 ${
                    category === item
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {templates.map((template) => {
              const firstSlide = parseMarpPresentation(template.markdown).slides[0];
              return (
                <div
                  key={template.id}
                  onClick={() => onNewDeckWithTemplate(template)}
                  className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  <div className="aspect-video bg-slate-50 overflow-hidden border-b border-slate-100">
                    <SlideView slide={firstSlide} theme={template.theme} showSlideNumber={false} />
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-center gap-3">
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                        {template.title}
                      </h3>
                      <Badge size="xs" variant="blue">{template.category}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">{template.description}</p>
                    <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Use template <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────── Recent Presentations ────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-sm font-semibold text-blue-600 tracking-wide uppercase mb-3">Your workspace</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Recent presentations
              </h2>
            </div>
            <div className="w-full sm:w-72">
              <Input placeholder="Search presentations" icon={Search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {error ? (
            <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-base font-medium text-rose-700">{error}</div>
          ) : isLoading ? (
            <div className="p-16 text-center text-slate-400 text-lg animate-pulse">Loading presentations...</div>
          ) : filteredDecks.length === 0 ? (
            <div className="p-16 text-center bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Presentation className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-lg font-semibold text-slate-700">Your next great deck starts here</p>
              <p className="text-sm text-slate-400 mt-2">Create your first presentation to see it appear here.</p>
              <Button variant="primary" size="md" icon={Plus} onClick={() => onNewDeckWithTemplate(null)} className="mt-6 !rounded-full">
                Create Presentation
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredDecks.map((deck) => {
                const parsed = parseMarpPresentation(deck.markdown);
                return (
                  <div
                    key={deck.id}
                    onClick={() => onOpenDeck(deck.id)}
                    className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    <div className="aspect-video bg-slate-50 overflow-hidden border-b border-slate-100">
                      <SlideView slide={parsed.slides[0]} theme={deck.theme} showSlideNumber={false} />
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-base text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {deck.title}
                        </h3>
                        <Badge size="xs" variant="blue">{parsed.slides.length}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                        <Clock3 className="w-3.5 h-3.5" />
                        {deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString() : 'Recently edited'}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          title="Duplicate"
                          onClick={(e) => handleDuplicate(e, deck)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => handleDelete(e, deck.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ────── Footer ────── */}
      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Presentation className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-700">MARP Studio</span>
          </div>
          <p className="text-xs text-slate-400">© 2024 MARP Studio. AI-powered presentation design.</p>
        </div>
      </footer>
    </main>
  );
}

export default Dashboard;
