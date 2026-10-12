import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { ThemeProvider } from '../context/ThemeContext';
import { presentationService } from '../services/presentationService';
import { configService } from '../services/configService';

const generation = vi.hoisted(() => ({ run: vi.fn(), cancel: vi.fn(), pending: false, event: null, status: 'idle', error: '' }));
const config = {
  dashboard: { defaultSection: 'home', sectionOrder: ['home', 'templates', 'ai', 'upload'], labels: { home: 'Home', templates: 'Explore Templates', ai: 'Create with AI', upload: 'Upload Custom Template' }, descriptions: { home: 'Home', templates: 'Templates', ai: 'AI', upload: 'Upload' }, visibleSections: { home: true, templates: true, ai: true, upload: true } },
  featureFlags: { exploreTemplates: true, createWithAI: true, uploadTemplate: true },
  templates: [{ id: 'tpl-1', backendId: 'tpl-1', title: 'Project Brief', name: 'Project Brief', category: 'business', theme: 'minimal', markdown: '# Brief', active: true }],
  themes: [{ id: 'minimal', backendId: 'theme-1' }],
};

vi.mock('../services/presentationService', () => ({ presentationService: { listPresentations: vi.fn(), createPresentation: vi.fn(), deletePresentation: vi.fn() } }));
vi.mock('../services/configService', () => ({ configService: { createTemplate: vi.fn(), load: vi.fn(), publish: vi.fn(), saveDraft: vi.fn() } }));
vi.mock('../context/MarpConfigContext', () => ({ useMarpConfig: () => ({ config, loading: false, error: '', reload: vi.fn() }) }));
vi.mock('../hooks/useGeneration', () => ({ default: () => generation }));
vi.mock('../hooks/useSources', () => ({ default: () => ({ sources: [], readyIds: [], blocked: false, upload: vi.fn(), remove: vi.fn(), error: '' }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const mount = (props = {}) => render(<MemoryRouter><ThemeProvider><Dashboard onOpenDeck={vi.fn()} onNewDeckWithTemplate={vi.fn()} {...props} /></ThemeProvider></MemoryRouter>);

describe('Dashboard workspace', () => {
  it('navigates End using only visible sections', async () => {
    presentationService.listPresentations.mockResolvedValue([]);
    config.featureFlags.uploadTemplate = false;
    try {
      mount();
      const home = await screen.findByRole('tab', { name: 'Home' });
      fireEvent.keyDown(home, { key: 'End' });
      expect(screen.getByRole('tab', { name: 'Create with AI' })).toHaveAttribute('aria-selected', 'true');
    } finally { config.featureFlags.uploadTemplate = true; }
  });

  it('honors the configured initial section', async () => {
    presentationService.listPresentations.mockResolvedValue([]);
    config.dashboard.defaultSection = 'ai';
    try {
      mount();
      expect(await screen.findByRole('tab', { name: 'Create with AI' })).toHaveAttribute('aria-selected', 'true');
    } finally { config.dashboard.defaultSection = 'home'; }
  });
  it('loads, opens, and deletes persisted presentations', async () => {
    const deck = { id: 'deck-1', title: 'Persistent deck', markdown: '# Slide', theme: 'minimal' };
    presentationService.listPresentations.mockResolvedValue([deck]);
    presentationService.deletePresentation.mockResolvedValue();
    const onOpenDeck = vi.fn();
    vi.stubGlobal('confirm', vi.fn(() => true));
    mount({ onOpenDeck });
    fireEvent.click(await screen.findByRole('button', { name: 'Open Persistent deck' }));
    expect(onOpenDeck).toHaveBeenCalledWith('deck-1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Persistent deck' }));
    await waitFor(() => expect(presentationService.deletePresentation).toHaveBeenCalledWith('deck-1'));
  });

  it('creates from the backend template catalog', async () => {
    presentationService.listPresentations.mockResolvedValue([]);
    const onCreate = vi.fn().mockResolvedValue({ id: 'new' });
    mount({ onNewDeckWithTemplate: onCreate });
    fireEvent.click(await screen.findByRole('tab', { name: 'Explore Templates' }));
    fireEvent.click(await screen.findByRole('button', { name: /Project Brief business/ }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ backendId: 'tpl-1' })));
  });

  it('persists uploaded Markdown as a backend template', async () => {
    presentationService.listPresentations.mockResolvedValue([]);
    configService.createTemplate.mockResolvedValue({ id: 'tpl-2' });
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Upload Custom Template' }));
    fireEvent.change(screen.getByLabelText('Choose Markdown file'), { target: { files: [{ name: 'story.md', size: 100, text: vi.fn().mockResolvedValue('# Story') }] } });
    await screen.findByLabelText('Template name');
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(configService.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: 'story', starter_markdown: '# Story' })));
  });

  it('routes a completed AI job to its persisted presentation', async () => {
    presentationService.listPresentations.mockResolvedValue([]);
    generation.run.mockResolvedValue({ presentation_id: 'generated-1', persisted: true });
    const onCreate = vi.fn();
    mount({ onNewDeckWithTemplate: onCreate });
    fireEvent.click(await screen.findByRole('tab', { name: 'Create with AI' }));
    fireEvent.change(screen.getByLabelText('What should your presentation make clear?'), { target: { value: 'Launch plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate presentation' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ presentationId: 'generated-1' }));
  });
});
