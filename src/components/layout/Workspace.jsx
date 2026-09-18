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

const SPLIT_RATIO_KEY = 'marp-split-ratio';

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
  onApplyMarkdown,
}) {
  const [splitRatio, setSplitRatio] = useState(() => Number(localStorage.getItem(SPLIT_RATIO_KEY)) || 0.68);
  const workspaceRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(SPLIT_RATIO_KEY, String(splitRatio));
  }, [splitRatio]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!draggingRef.current || !workspaceRef.current) return;
      const bounds = workspaceRef.current.getBoundingClientRect();
      const nextRatio = (event.clientX - bounds.left) / bounds.width;
      setSplitRatio(Math.min(0.78, Math.max(0.45, nextRatio)));
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
        onOpenAiModal={onOpenAiModal}
      />

      {/* Main Authoring Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Markdown editor is intentionally exclusive to the Editor tab. */}
        {viewMode === 'editor' && (
          <div
            className="flex flex-col h-full bg-white border-r border-slate-200/80 w-full"
          >
            <div className="flex-1 relative overflow-hidden">
              <CodeMirrorEditor
                value={markdown}
                onChange={onMarkdownChange}
                onEditorReady={onEditorReady}
                onEditorUpdate={onEditorUpdate}
              />
            </div>
          </div>
        )}

        {/* Split view is the visual canvas plus contextual agent. */}
        {viewMode === 'split' && (
          <div ref={workspaceRef} className="split-workspace h-full flex flex-1 min-w-0" style={{ '--split-ratio': `${splitRatio * 100}%` }}>
            <div className="split-preview h-full min-w-0 border-r border-slate-200/80">
              <div className="split-design-toolbar sticky top-0 z-10">
                <EditorToolbar onFormat={onFormat} currentTheme={theme} onChangeTheme={onChangeTheme} />
              </div>
              <div className="split-canvas h-[calc(100%-48px)] min-h-0">
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
            </div>
            <button type="button" className="split-divider hidden md:block" aria-label="Resize presentation and controls" onPointerDown={startDragging} onDoubleClick={() => setSplitRatio(0.68)} />
            <aside className="split-panel h-full shrink-0 hidden md:block">
              <AIAgentPanel
                onApplyMarkdown={onApplyMarkdown}
                wsStatus={wsStatus}
                wsEventState={wsEventState}
                onGenerate={onGenerate}
              />
            </aside>
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
