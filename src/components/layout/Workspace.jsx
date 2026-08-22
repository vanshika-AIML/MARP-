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
        {/* Editor Pane */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div
            className={`flex flex-col h-full bg-white border-r border-slate-200/80 ${
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            }`}
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

        {/* Live Preview Pane */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div
            className={`h-full ${
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            }`}
          >
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
