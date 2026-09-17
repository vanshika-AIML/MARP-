/**
 * Workspace Component
 * Primary presentation authoring layout supporting split, editor-only,
 * and preview-only modes with collapsible slide navigation.
 */
import React from 'react';
import Sidebar from './Sidebar';
import CodeMirrorEditor from '../editor/CodeMirrorEditor';
import EditorToolbar from '../editor/EditorToolbar';
import MarkdownPreview from '../editor/MarkdownPreview';
import AIAgentPanel from '../editor/AIAgentPanel';

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
  onSimulateStream,
  onApplyMarkdown,
}) {
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
            <EditorToolbar
              onFormat={onFormat}
              currentTheme={theme}
              onChangeTheme={onChangeTheme}
            />
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
          <>
            <div className="h-full flex-1 min-w-0 border-r border-slate-200/80">
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
            <aside className="h-full w-[340px] shrink-0 hidden md:block">
              <AIAgentPanel
                onApplyMarkdown={onApplyMarkdown}
                wsStatus={wsStatus}
                onSimulateStream={onSimulateStream}
              />
            </aside>
          </>
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
