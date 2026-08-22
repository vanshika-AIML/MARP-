/**
 * Dashboard Page
 * Presentation catalog, starter templates, deck creation, and management.
 */
import React, { useState, useEffect } from 'react';
import {
  Plus,
  Presentation,
  Sparkles,
  Search,
  Clock,
  Trash2,
  Copy,
  ArrowRight,
  LayoutTemplate,
  Layers,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { STARTER_TEMPLATES, BLANK_DECK_MARKDOWN } from '../utils/mockData';
import { presentationService } from '../services/presentationService';
import SlideView from '../components/presentation/SlideView';
import { parseMarpPresentation } from '../utils/marpParser';

export function Dashboard({ onOpenDeck, onNewDeckWithTemplate }) {
  const [presentations, setPresentations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchDecks = async () => {
    setIsLoading(true);
    try {
      const list = await presentationService.listPresentations();
      setPresentations(list);
    } catch (err) {
      console.error('Failed to load presentations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this presentation?')) {
      await presentationService.deletePresentation(id);
      fetchDecks();
    }
  };

  const handleDuplicate = async (e, deck) => {
    e.stopPropagation();
    await presentationService.createPresentation({
      title: `${deck.title} (Copy)`,
      theme: deck.theme,
      markdown: deck.markdown,
    });
    fetchDecks();
  };

  const filteredDecks = presentations.filter((p) =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-6 md:p-10 text-left">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Presentation Library
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Create, edit, and organize your MARP Markdown presentations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => onNewDeckWithTemplate(null)}
              className="shadow-sm"
            >
              Blank Presentation
            </Button>
          </div>
        </div>

        {/* Templates Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <LayoutTemplate className="w-3.5 h-3.5 text-sky-600" />
            <span>Starter Templates</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STARTER_TEMPLATES.map((tmpl) => {
              const parsed = parseMarpPresentation(tmpl.markdown);
              const firstSlide = parsed.slides[0];

              return (
                <Card
                  key={tmpl.id}
                  hoverable
                  onClick={() => onNewDeckWithTemplate(tmpl)}
                  className="flex flex-col h-full group"
                >
                  <div className="aspect-slide bg-slate-100 border-b border-slate-100 overflow-hidden relative pointer-events-none text-[8px]">
                    <SlideView slide={firstSlide} theme={tmpl.theme} showSlideNumber={false} />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
                          {tmpl.title}
                        </h3>
                        <Badge size="xs" variant="slate" className="capitalize">
                          {tmpl.theme}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {tmpl.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-sky-600 font-medium">
                      <span>Use this template</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Existing Decks Section */}
        <section className="space-y-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>All Presentations ({filteredDecks.length})</span>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="Search presentations..."
                icon={Search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading presentations...</div>
          ) : filteredDecks.length === 0 ? (
            <div className="p-12 bg-white rounded-lg border border-slate-200 text-center space-y-3">
              <Presentation className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-xs text-slate-500">No presentations matching your search.</div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onNewDeckWithTemplate(null)}
              >
                Create New Presentation
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDecks.map((deck) => {
                const parsed = parseMarpPresentation(deck.markdown);
                const firstSlide = parsed.slides[0];
                const slideCount = parsed.slides.length;

                return (
                  <Card
                    key={deck.id}
                    hoverable
                    onClick={() => onOpenDeck(deck.id)}
                    className="flex flex-col h-full group"
                  >
                    <div className="aspect-slide bg-slate-100 border-b border-slate-100 overflow-hidden relative pointer-events-none text-[8px]">
                      <SlideView slide={firstSlide} theme={deck.theme} showSlideNumber={false} />
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 truncate transition-colors">
                            {deck.title}
                          </h4>
                          <Badge size="xs" variant="blue">
                            {slideCount} slides
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {deck.updatedAt
                              ? new Date(deck.updatedAt).toLocaleDateString()
                              : 'Recently edited'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-mono text-slate-400 capitalize">
                          {deck.theme || 'default'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(e, deck)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Duplicate Presentation"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, deck.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Presentation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
