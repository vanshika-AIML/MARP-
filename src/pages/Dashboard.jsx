import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Home, LayoutGrid, PanelsTopLeft, UploadCloud, PanelLeftClose, PanelLeftOpen, Plus, Copy, Trash2, Search, ArrowUpRight, FolderOpen } from 'lucide-react';
import SiteHeader from '../components/landing/SiteHeader';
import CreateWithAI from '../components/dashboard/CreateWithAI';
import UploadTemplate from '../components/dashboard/UploadTemplate';
import { DeckSkeletons } from '../components/ui/ContentLoaders';
import SlideView from '../components/presentation/SlideView';
import { presentationService } from '../services/presentationService';
import { parseMarpPresentation } from '../utils/marpParser';
import { readCustomTemplates } from '../utils/templateCatalog';
import { useMarpConfig } from '../context/MarpConfigContext';
const TemplatesPanel = lazy(() => import('../components/dashboard/TemplatesPanel'));
const sections = [
  ['home', Home, 'Home', 'Your next great story starts here.'],
  ['templates', LayoutGrid, 'Explore Templates', 'A different personality for every presentation.'],
  ['ai', PanelsTopLeft, 'Create with AI', 'Start with an idea. Leave with a first draft.'],
  ['upload', UploadCloud, 'Upload Custom Template', 'Your own Markdown. Your own point of view.'],
];
export default function Dashboard({ onOpenDeck, onNewDeckWithTemplate }) {
  const { config } = useMarpConfig();
  const [tab, setTab] = useState('home');
  const [collapsed, setCollapsed] = useState(() => window.matchMedia?.('(max-width: 760px)').matches || false);
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(readCustomTemplates);
  const tabRefs = useRef([]);
  const fetchDecks = async () => {
    setLoading(true); setError('');
    try { setPresentations(await presentationService.listPresentations()); }
    catch (err) { setError(err.message || 'Could not load presentations.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchDecks(); }, []);
  const run = async (id, action) => { if (busy) return; setBusy(id); setError(''); try { await action(); } catch (err) { setError(err.message || 'Please try again.'); } finally { setBusy(null); } };
  const duplicate = (deck) => run(deck.id, async () => { await presentationService.createPresentation({ title: `${deck.title} (Copy)`, theme: deck.theme, markdown: deck.markdown }); await fetchDecks(); });
  const remove = (deck) => { if (window.confirm(`Delete ${deck.title}?`)) run(deck.id, async () => { await presentationService.deletePresentation(deck.id); await fetchDecks(); }); };
  const onTabKey = (event, index) => {
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % configuredSections.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + configuredSections.length - 1) % configuredSections.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = sections.length - 1;
    if (next !== undefined) { event.preventDefault(); setTab(configuredSections[next][0]); tabRefs.current[next]?.focus(); }
  };
  const configuredSections = sections.map(([id, Icon, fallbackLabel, fallbackDescription]) => [id, Icon, config.dashboard.labels[id] || fallbackLabel, config.dashboard.descriptions[id] || fallbackDescription]).filter(([id]) => config.dashboard.visibleSections[id] && (id === 'templates' ? config.featureFlags.exploreTemplates : id === 'ai' ? config.featureFlags.createWithAI : id === 'upload' ? config.featureFlags.uploadTemplate : true)).sort((a, b) => config.dashboard.sectionOrder.indexOf(a[0]) - config.dashboard.sectionOrder.indexOf(b[0]));
  const active = configuredSections.find(([id]) => tab === id) || configuredSections[0];
  const filtered = presentations.filter((deck) => deck.title?.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (!config.dashboard.visibleSections[tab]) setTab(config.dashboard.defaultSection); }, [config.dashboard.defaultSection, config.dashboard.visibleSections, tab]);
  return <div className="dashboard-app"><SiteHeader /><div className={`dashboard-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="dashboard-sidebar" aria-label="Dashboard sidebar"><div className="sidebar-top"><span className="sidebar-label eyebrow">Workspace</span><button onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-controls="dashboard-tabs" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button></div>
      <nav id="dashboard-tabs" role="tablist" aria-label="Dashboard sections" aria-orientation="vertical">{configuredSections.map(([id, Icon, label], i) => <button key={id} ref={(element) => { tabRefs.current[i] = element; }} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onKeyDown={(event) => onTabKey(event, i)} onClick={() => setTab(id)} title={label}><Icon size={20} /><span className="sidebar-label">{label}</span></button>)}</nav>
      <div className="sidebar-foot sidebar-label"><span className="sidebar-system-mark" aria-hidden="true"><i /><i /><i /></span><p>A focused space for<br />your next presentation.</p></div>
    </aside>
    <main className="dashboard-main"><div className="dashboard-heading"><div><span className="eyebrow">MARP Studio / Workspace</span><h1>{tab === 'home' ? 'Dashboard' : active[2]}</h1><p>{active[3]}</p></div>{tab === 'home' && <button className="primary-cta" disabled={!!busy} onClick={() => run('new', () => onNewDeckWithTemplate(null))}><Plus size={18} />{busy === 'new' ? 'Creating…' : 'Create Presentation'}</button>}</div>
      <div role="tabpanel" id={`panel-${tab === 'ai' || tab === 'upload' ? 'home' : tab}`} aria-labelledby={`tab-${tab === 'ai' || tab === 'upload' ? 'home' : tab}`} hidden={tab === 'ai' || tab === 'upload'} className="dashboard-tab" tabIndex={0}>
        {tab === 'home' && <section><div className="home-section-heading"><h2>Your presentations <span>{presentations.length}</span></h2><label className="dashboard-search"><Search size={17} /><span className="sr-only">Search presentations</span><input placeholder="Find a presentation…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          {error && <div role="alert" className="ui-error">{error} <button onClick={fetchDecks}>Try again</button></div>}
          {loading ? <DeckSkeletons /> : <div className="deck-grid">{filtered.map((deck, index) => <article className="dashboard-deck" style={{ '--card-index': index % 12 }} key={deck.id} aria-busy={busy === deck.id}><button className="deck-open" onClick={() => onOpenDeck(deck.id)} aria-label={`Open ${deck.title}`}><div className="template-preview"><SlideView slide={parseMarpPresentation(deck.markdown).slides[0]} theme={deck.theme} showSlideNumber={false} /></div><h3>{deck.title}</h3></button><div className="deck-meta"><span>{busy === deck.id ? 'Updating…' : `${parseMarpPresentation(deck.markdown).slides.length} slides`}</span><button aria-label={`Duplicate ${deck.title}`} disabled={!!busy} onClick={() => duplicate(deck)}><Copy size={16} /></button><button aria-label={`Delete ${deck.title}`} disabled={!!busy} onClick={() => remove(deck)}><Trash2 size={16} /></button></div></article>)}</div>}
          {!loading && !error && !filtered.length && <div className="empty-state"><FolderOpen size={36} /><h3>{query ? 'No matching presentations' : 'Your story starts with one slide.'}</h3><p>{query ? 'Try a different search.' : 'Create a deck or find a template that feels like you.'}</p><button onClick={() => setTab('templates')}>Explore Templates <ArrowUpRight size={16} /></button></div>}
        </section>}
        {tab === 'templates' && <Suspense fallback={<DeckSkeletons label="Loading templates" />}><TemplatesPanel customTemplates={custom} onCreate={onNewDeckWithTemplate} /></Suspense>}
      </div>
      <div role="tabpanel" id="panel-ai" aria-labelledby="tab-ai" hidden={tab !== 'ai'} className="dashboard-tab" tabIndex={0}><CreateWithAI onCreate={onNewDeckWithTemplate} /></div>
      <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" hidden={tab !== 'upload'} className="dashboard-tab" tabIndex={0}><UploadTemplate onSaved={setCustom} /></div>
    </main>
  </div></div>;
}
