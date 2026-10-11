import React, { useState, useCallback } from 'react';
import usePresentation from '../hooks/usePresentation';
import useEditor from '../hooks/useEditor';
import useGeneration from '../hooks/useGeneration';
import useSources from '../hooks/useSources';
import useHotkeys from '../hooks/useHotkeys';
import Navbar from '../components/layout/Navbar';
import Workspace from '../components/layout/Workspace';
import StatusBar from '../components/layout/StatusBar';
import GenerationOverlay from '../components/presentation/GenerationOverlay';
import ExportModal from '../components/presentation/ExportModal';
import PreviewPage from './PreviewPage';
import { presentationService } from '../services/presentationService';

const SLIDE_ACTIONS = new Set(['rewrite_slide', 'shorten_slide', 'expand_slide', 'simplify_slide', 'change_tone', 'make_professional', 'make_creative', 'make_technical', 'improve_storytelling', 'generate_speaker_notes', 'split_slide', 'suggest_visuals']);
const DECK_ACTIONS = new Set(['improve_entire_deck', 'reorder_suggestions']);

export function EditorPage({ onOpenDashboard, onNewDeckWithTemplate, previewRoute = false }) {
  const presentation = usePresentation();
  const { id, title, theme, markdown, slides, activeSlide, previewStatus, isSaving, updateMarkdown, setActiveSlide, setTitle, setTheme, setPreviewStatus, loadPresentation, addSlide, deleteSlide, duplicateSlide } = presentation;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const generation = useGeneration();
  const sources = useSources();

  React.useEffect(() => { if (previewRoute) setIsPresenting(true); }, [previewRoute]);
  const { setEditorView, insertFormat, jumpToSlide, handleEditorUpdate, getStats } = useEditor({ onSlideChange: (index) => { if (index !== activeSlide) setActiveSlide(index); } });
  const stats = getStats(markdown);

  const handleSelectSlide = useCallback((index) => { setActiveSlide(index); jumpToSlide(index, slides); }, [setActiveSlide, jumpToSlide, slides]);

  const handleGenerate = useCallback(async (prompt, action) => {
    const backendSlides = await presentationService.getSlides(id);
    const fields = { presentation_id: id, source_ids: sources.readyIds, options: { persist: true } };
    if (SLIDE_ACTIONS.has(action)) {
      const selected = backendSlides[activeSlide];
      if (!selected) throw new Error('Save and select a slide before running this action.');
      fields.slide_id = selected.id;
    }
    if (action === 'merge_slides') {
      const selected = backendSlides.slice(activeSlide, activeSlide + 2);
      if (selected.length < 2) throw new Error('Select a slide that has another slide after it.');
      fields.options.slide_ids = selected.map((slide) => slide.id);
    }
    if (DECK_ACTIONS.has(action) && !id) throw new Error('Save this presentation before running a deck action.');
    const result = await generation.run(prompt, action, fields);
    if (result.persisted) await loadPresentation(result.presentation_id || id);
    return result;
  }, [activeSlide, generation, id, loadPresentation, sources.readyIds]);

  useHotkeys({ onPresent: () => setIsPresenting(true), enabled: !isPresenting });

  const agentProps = {
    wsStatus: generation.status,
    wsEventState: generation.event,
    onGenerate: handleGenerate,
    onCancelGeneration: generation.cancel,
    generationPending: generation.pending,
    generationError: generation.error,
    sources,
  };

  return <div className="editor-page h-full flex flex-col overflow-hidden bg-white">
    <Navbar title={title} onTitleChange={setTitle} isSaving={isSaving} viewMode={previewStatus.viewMode} onViewModeChange={(viewMode) => setPreviewStatus({ viewMode })} onOpenAiModal={() => setIsAiModalOpen(true)} onOpenExportModal={() => setIsExportModalOpen(true)} onOpenDashboard={onOpenDashboard} onNewDeck={() => onNewDeckWithTemplate(null)} activePage="editor" />
    <Workspace sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} slides={slides} activeSlide={activeSlide} onSelectSlide={handleSelectSlide} onAddSlide={addSlide} onDuplicateSlide={duplicateSlide} onDeleteSlide={deleteSlide} onOpenAiModal={() => setIsAiModalOpen(true)} markdown={markdown} onMarkdownChange={updateMarkdown} onEditorReady={setEditorView} onEditorUpdate={(update) => handleEditorUpdate(update, slides)} onFormat={insertFormat} theme={theme} onChangeTheme={setTheme} viewMode={previewStatus.viewMode} zoom={previewStatus.zoom || 1} onNextSlide={() => setActiveSlide(Math.min(activeSlide + 1, slides.length - 1))} onPrevSlide={() => setActiveSlide(Math.max(0, activeSlide - 1))} onPresent={() => setIsPresenting(true)} onZoomIn={() => setPreviewStatus({ zoom: Math.min(1.5, (previewStatus.zoom || 1) + 0.1) })} onZoomOut={() => setPreviewStatus({ zoom: Math.max(0.6, (previewStatus.zoom || 1) - 0.1) })} onZoomReset={() => setPreviewStatus({ zoom: 1 })} {...agentProps} />
    <StatusBar wordCount={stats.words} charCount={stats.chars} currentSlide={activeSlide} totalSlides={slides.length} theme={theme} wsStatus={generation.status} />
    <GenerationOverlay isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} {...agentProps} />
    <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} presentation={{ id, title, theme, markdown, slides }} />
    {isPresenting && <PreviewPage presentation={{ id, title, theme, markdown, slides }} activeSlide={activeSlide} onSlideChange={setActiveSlide} onExit={() => setIsPresenting(false)} />}
  </div>;
}
export default EditorPage;
