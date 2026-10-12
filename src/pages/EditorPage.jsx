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
import { useMarpConfig } from '../context/MarpConfigContext';
import Modal from '../components/ui/Modal';
import SlideView from '../components/presentation/SlideView';
import { parseMarpPresentation } from '../utils/marpParser';

const SLIDE_ACTIONS = new Set(['rewrite_slide', 'shorten_slide', 'expand_slide', 'simplify_slide', 'change_tone', 'make_professional', 'make_creative', 'make_technical', 'improve_storytelling', 'generate_speaker_notes', 'split_slide', 'suggest_visuals']);
const DECK_ACTIONS = new Set(['improve_entire_deck', 'reorder_suggestions']);

export function EditorPage({ onOpenDashboard, onNewDeckWithTemplate, previewRoute = false }) {
  const presentation = usePresentation();
  const { id, title, theme, markdown, slides, activeSlide, previewStatus, isSaving, saveError, editRevision, savedRevision, savePresentation, updateMarkdown, setActiveSlide, setTitle, setTheme, setPreviewStatus, loadPresentation, addSlide, deleteSlide, duplicateSlide } = presentation;
  const { config } = useMarpConfig();
  const [actionError, setActionError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const actionActive = React.useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia?.('(max-width: 767px)').matches);
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
    if (actionActive.current) return;
    actionActive.current = true;
    setPreparing(true); setActionError('');
    try {
    await savePresentation();
    const backendSlides = await presentationService.getSlides(id);
    const fields = { presentation_id: id, source_ids: sources.readyIds, options: { persist: true, theme } };
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
    if (result.persisted) {
      await loadPresentation(result.presentation_id || id);
      if (SLIDE_ACTIONS.has(action)) setActiveSlide(activeSlide);
      setPreviewStatus({ viewMode: 'split' });
      setIsAiModalOpen(false);
    }
    if (!result.persisted || ['generate_speaker_notes', 'suggest_visuals', 'reorder_suggestions'].includes(action)) {
      setGeneratedResult({ ...result, suggestedOrder: result.reorder_suggestions?.slide_ids.map((slideId) => backendSlides.findIndex((slide) => slide.id === slideId) + 1).join(', ') });
    }
    return result;
    } catch (error) { setActionError(error.message); throw error; }
    finally { actionActive.current = false; setPreparing(false); }
  }, [activeSlide, generation, id, loadPresentation, sources.readyIds, savePresentation, theme, setActiveSlide, setPreviewStatus]);

  const save = () => savePresentation().then(() => setActionError('')).catch((error) => setActionError(error.message));
  const navigateAfterSave = async (action) => {
    try { await savePresentation(); await action(); }
    catch (error) { setActionError(error.message); }
  };
  useHotkeys({ onSave: save, onPresent: () => setIsPresenting(true), enabled: !isPresenting });

  const agentProps = {
    wsStatus: generation.status,
    wsEventState: generation.event,
    onGenerate: handleGenerate,
    onCancelGeneration: generation.cancel,
    generationPending: generation.pending || preparing,
    generationError: actionError || generation.error,
    sources,
  };

  return <div className="editor-page h-full flex flex-col overflow-hidden bg-white">
    <Navbar title={title} onTitleChange={setTitle} isSaving={isSaving} saveError={saveError} isDirty={editRevision !== savedRevision} viewMode={previewStatus.viewMode} onViewModeChange={(viewMode) => setPreviewStatus({ viewMode })} onOpenAiModal={config.featureFlags.aiAgent ? () => setIsAiModalOpen(true) : undefined} onOpenExportModal={config.featureFlags.exports ? () => setIsExportModalOpen(true) : undefined} onOpenDashboard={() => navigateAfterSave(onOpenDashboard)} onNewDeck={() => navigateAfterSave(() => onNewDeckWithTemplate(null))} activePage="editor" />
    {(saveError || actionError) && <div role="alert" className="ui-error">{saveError || actionError}{saveError && <button onClick={save}>Retry save</button>}</div>}
    <Workspace sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} slides={slides} activeSlide={activeSlide} onSelectSlide={handleSelectSlide} onAddSlide={addSlide} onDuplicateSlide={duplicateSlide} onDeleteSlide={deleteSlide} onOpenAiModal={() => setIsAiModalOpen(true)} markdown={markdown} onMarkdownChange={updateMarkdown} onEditorReady={setEditorView} onEditorUpdate={(update) => handleEditorUpdate(update, slides)} onFormat={insertFormat} theme={theme} onChangeTheme={setTheme} viewMode={previewStatus.viewMode} zoom={previewStatus.zoom || 1} onNextSlide={() => setActiveSlide(Math.min(activeSlide + 1, slides.length - 1))} onPrevSlide={() => setActiveSlide(Math.max(0, activeSlide - 1))} onPresent={() => setIsPresenting(true)} onZoomIn={() => setPreviewStatus({ zoom: Math.min(1.5, (previewStatus.zoom || 1) + 0.1) })} onZoomOut={() => setPreviewStatus({ zoom: Math.max(0.6, (previewStatus.zoom || 1) - 0.1) })} onZoomReset={() => setPreviewStatus({ zoom: 1 })} {...agentProps} />
    <StatusBar wordCount={stats.words} charCount={stats.chars} currentSlide={activeSlide} totalSlides={slides.length} theme={theme} wsStatus={generation.status} />
    <GenerationOverlay isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} {...agentProps} />
    <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} presentation={{ id, title, theme, markdown, slides }} />
    <Modal isOpen={!!generatedResult} onClose={() => setGeneratedResult(null)} title="AI result">
      {generatedResult?.reorder_suggestions && <p>{generatedResult.reorder_suggestions.rationale}<br />Suggested slide order: {generatedResult.suggestedOrder}</p>}
      {generatedResult?.presentation?.slides?.map((slide, index) => <div key={index} className="mb-4">
        {slide.speaker_notes && <><h3 className="font-semibold">{slide.title || `Slide ${index + 1}`} — Speaker notes</h3><p className="whitespace-pre-wrap">{slide.speaker_notes}</p></>}
        {slide.visual_intent?.type !== 'none' && (slide.visual_intent?.query || slide.visual_intent?.prompt) && <p>Visual suggestion: {slide.visual_intent.query || slide.visual_intent.prompt}</p>}
      </div>)}
      {generatedResult && !generatedResult.persisted && !generatedResult.reorder_suggestions && parseMarpPresentation(generatedResult.markdown).slides.map((slide, index) => <div key={index} className="aspect-slide mb-3"><SlideView slide={slide} /></div>)}
    </Modal>
    {isPresenting && <PreviewPage presentation={{ id, title, theme, markdown, slides }} activeSlide={activeSlide} onSlideChange={setActiveSlide} onExit={() => setIsPresenting(false)} />}
  </div>;
}
export default EditorPage;
