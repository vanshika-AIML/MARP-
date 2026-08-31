/**
 * EditorPage Component
 * Primary workspace for authoring MARP presentations, connecting
 * CodeMirror markdown editor, live preview, WebSocket status, and export actions.
 */
import React, { useState, useCallback } from 'react';
import usePresentation from '../hooks/usePresentation';
import useEditor from '../hooks/useEditor';
import useWebSocket from '../hooks/useWebSocket';
import useHotkeys from '../hooks/useHotkeys';
import Navbar from '../components/layout/Navbar';
import Workspace from '../components/layout/Workspace';
import StatusBar from '../components/layout/StatusBar';
import GenerationOverlay from '../components/presentation/GenerationOverlay';
import ExportModal from '../components/presentation/ExportModal';
import PreviewPage from './PreviewPage';
import { STARTER_TEMPLATES } from '../utils/mockData';

export function EditorPage({ onOpenDashboard, onNewDeckWithTemplate }) {
  const presentation = usePresentation();
  const {
    id,
    title,
    theme,
    markdown,
    slides,
    activeSlide,
    previewStatus,
    isSaving,
    updateMarkdown,
    setActiveSlide,
    setTitle,
    setTheme,
    setPreviewStatus,
    addSlide,
    deleteSlide,
    duplicateSlide,
  } = presentation;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);

  // Editor hook for CodeMirror manipulation & slide synchronization
  const {
    setEditorView,
    insertFormat,
    jumpToSlide,
    handleEditorUpdate,
    getStats,
  } = useEditor({
    onSlideChange: (idx) => {
      if (idx !== activeSlide) {
        setActiveSlide(idx);
      }
    },
  });

  // Real-time WebSocket hook
  const {
    status: wsStatus,
    eventState: wsEventState,
    simulateGenerationStream,
  } = useWebSocket();

  // Document word/character statistics
  const stats = getStats(markdown);

  const handleSelectSlide = useCallback((index) => {
    setActiveSlide(index);
    jumpToSlide(index, slides);
  }, [setActiveSlide, jumpToSlide, slides]);

  const handleViewModeChange = (mode) => {
    setPreviewStatus({ viewMode: mode });
  };

  const handleApplyAiGeneratedMarkdown = (generated, isFullDeck = false) => {
    if (isFullDeck) {
      updateMarkdown(generated);
      setActiveSlide(0);
    } else {
      const newMarkdown = `${markdown.trimEnd()}${generated}`;
      updateMarkdown(newMarkdown);
      setActiveSlide(slides.length);
    }
  };

  // Keyboard shortcuts
  useHotkeys({
    onPresent: () => setIsPresenting(true),
    enabled: !isPresenting,
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Top Navigation */}
      <Navbar
        title={title}
        onTitleChange={setTitle}
        isSaving={isSaving}
        viewMode={previewStatus.viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenDashboard={onOpenDashboard}
        onNewDeck={() => onNewDeckWithTemplate(null)}
        activePage="editor"
      />

      {/* Main Workspace (Sidebar + Editor / Preview) */}
      <Workspace
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        slides={slides}
        activeSlide={activeSlide}
        onSelectSlide={handleSelectSlide}
        onAddSlide={addSlide}
        onDuplicateSlide={duplicateSlide}
        onDeleteSlide={deleteSlide}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        markdown={markdown}
        onMarkdownChange={updateMarkdown}
        onEditorReady={setEditorView}
        onEditorUpdate={(update) => handleEditorUpdate(update, slides)}
        onFormat={insertFormat}
        theme={theme}
        onChangeTheme={setTheme}
        viewMode={previewStatus.viewMode}
        zoom={previewStatus.zoom || 1.0}
        onNextSlide={() => setActiveSlide(Math.min(activeSlide + 1, slides.length - 1))}
        onPrevSlide={() => setActiveSlide(Math.max(0, activeSlide - 1))}
        onPresent={() => setIsPresenting(true)}
        onZoomIn={() => setPreviewStatus({ zoom: Math.min(1.5, (previewStatus.zoom || 1.0) + 0.1) })}
        onZoomOut={() => setPreviewStatus({ zoom: Math.max(0.6, (previewStatus.zoom || 1.0) - 0.1) })}
        onZoomReset={() => setPreviewStatus({ zoom: 1.0 })}
        wsStatus={wsStatus}
        onSimulateStream={simulateGenerationStream}
        onApplyMarkdown={handleApplyAiGeneratedMarkdown}
      />

      {/* Bottom Status Bar */}
      <StatusBar
        wordCount={stats.words}
        charCount={stats.chars}
        currentSlide={activeSlide}
        totalSlides={slides.length}
        theme={theme}
        wsStatus={wsStatus}
      />

      {/* AI Generator Modal with WebSocket Streaming */}
      <GenerationOverlay
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyMarkdown={handleApplyAiGeneratedMarkdown}
        wsStatus={wsStatus}
        wsEventState={wsEventState}
        onSimulateStream={simulateGenerationStream}
      />

      {/* Export Options Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        presentation={{ id, title, theme, markdown, slides }}
      />

      {/* Fullscreen Live Presentation Mode */}
      {isPresenting && (
        <PreviewPage
          presentation={{ id, title, theme, markdown, slides }}
          activeSlide={activeSlide}
          onSlideChange={setActiveSlide}
          onExit={() => setIsPresenting(false)}
        />
      )}
    </div>
  );
}

export default EditorPage;
