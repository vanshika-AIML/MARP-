/**
 * Workspace Component
 * Primary presentation authoring layout supporting split, editor-only,
 * and preview-only modes with collapsible slide navigation.
 */
import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import CodeMirrorEditor from '../editor/CodeMirrorEditor';
import EditorToolbar from '../editor/EditorToolbar';
import MarkdownPreview from '../editor/MarkdownPreview';
import AIAgentPanel from '../editor/AIAgentPanel';
import { useMarpConfig } from '../../context/MarpConfigContext';

const PANEL_WIDTH_KEY = 'marp-agent-width';

export function Workspace({
  sidebarOpen,
  onToggleSidebar,
  slides,
  activeSlide,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onOpenAiModal,
  markdown,
  onMarkdownChange,
  onEditorReady,
  onEditorUpdate,
  onFormat,
  theme,
  onChangeTheme,
  viewMode,
  zoom,
  onNextSlide,
  onPrevSlide,
  onPresent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  wsStatus,
  wsEventState,
  onGenerate,
  onCancelGeneration,
  generationPending,
  generationError,
  sources,
}) {
  const { config } = useMarpConfig();
  const [panelWidth, setPanelWidth] = useState(() => Math.min(440, Math.max(280, Number(localStorage.getItem(PANEL_WIDTH_KEY)) || 320)));
  const [agentOpen, setAgentOpen] = useState(true);
  const workspaceRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!draggingRef.current || !workspaceRef.current) return;
      const bounds = workspaceRef.current.getBoundingClientRect();
      setPanelWidth(Math.min(440, Math.max(280, bounds.right - event.clientX)));
    };
    const stopDragging = () => {
      draggingRef.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      document.body.classList.remove('is-resizing');
    };
  }, []);

  const startDragging = () => {
    draggingRef.current = true;
    document.body.classList.add('is-resizing');
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Slide Navigator Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={onToggleSidebar}
        slides={slides}
        activeSlide={activeSlide}
        onSelectSlide={onSelectSlide}
        onAddSlide={onAddSlide}
        onDuplicateSlide={onDuplicateSlide}
        onDeleteSlide={onDeleteSlide}
        onOpenAiModal={config.featureFlags.aiAgent ? onOpenAiModal : undefined}
      />

      {/* Main Authoring Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Focused Markdown view. */}
        {viewMode === 'editor' && (
          <div
            className="flex flex-col h-full bg-white border-r border-slate-200/80 w-full"
          >
            <div className="flex-1 relative overflow-hidden">
              <CodeMirrorEditor
                readOnly={generationPending}
                value={markdown}
                onChange={onMarkdownChange}
                onEditorReady={onEditorReady}
                onEditorUpdate={onEditorUpdate}
              />
            </div>
          </div>
        )}

        {/* Split view shares the editor, live canvas, and contextual agent. */}
        {viewMode === 'split' && (
          <div ref={workspaceRef} className="split-workspace h-full flex flex-col flex-1 min-w-0" style={{ '--agent-width': `${panelWidth}px` }}>
            <div className="split-design-toolbar relative z-20">
              <EditorToolbar onFormat={onFormat} currentTheme={theme} onChangeTheme={onChangeTheme} disabled={generationPending} />
              {config.featureFlags.aiAgent && <button type="button" className="agent-toggle" aria-expanded={agentOpen} aria-controls="split-agent" onClick={() => setAgentOpen(!agentOpen)}>{agentOpen ? 'Hide AI Agent' : 'Show AI Agent'}</button>}
            </div>
            <div className="split-columns">
              <section className="split-editor" aria-label="Markdown editor">
                <CodeMirrorEditor readOnly={generationPending} value={markdown} onChange={onMarkdownChange} onEditorReady={onEditorReady} onEditorUpdate={onEditorUpdate} />
              </section>
              <div className="split-preview">
                <MarkdownPreview slide={slides[activeSlide]} slides={slides} activeSlide={activeSlide} theme={theme} zoom={zoom} onNextSlide={onNextSlide} onPrevSlide={onPrevSlide} onPresent={onPresent} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onZoomReset={onZoomReset} />
              </div>
              {config.featureFlags.aiAgent && agentOpen && <>
                <div role="separator" tabIndex={0} className="split-divider" aria-label="Resize AI Agent" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={440} aria-valuenow={panelWidth} onPointerDown={startDragging} onDoubleClick={() => setPanelWidth(320)} onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  setPanelWidth((width) => event.key === 'Home' ? 280 : event.key === 'End' ? 440 : Math.min(440, Math.max(280, width + (event.key === 'ArrowLeft' ? 20 : -20))));
                }} />
                <aside id="split-agent" className="split-panel">
                  <AIAgentPanel wsStatus={wsStatus} wsEventState={wsEventState} onGenerate={onGenerate} onCancelGeneration={onCancelGeneration} generationPending={generationPending} generationError={generationError} sources={sources} />
                </aside>
              </>}
            </div>
          </div>
        )}

        {/* Preview tab keeps the full visual presentation surface. */}
        {viewMode === 'preview' && (
          <div className="h-full w-full">
            <MarkdownPreview
              slide={slides[activeSlide]}
              slides={slides}
              activeSlide={activeSlide}
              theme={theme}
              zoom={zoom}
              onNextSlide={onNextSlide}
              onPrevSlide={onPrevSlide}
              onPresent={onPresent}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onZoomReset={onZoomReset}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default Workspace;
