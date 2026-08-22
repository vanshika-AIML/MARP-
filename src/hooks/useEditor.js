/**
 * useEditor Hook
 * Manages CodeMirror editor instance ref, formatting dispatcher,
 * and bi-directional cursor line <-> active slide synchronization.
 */
import { useRef, useCallback } from 'react';
import { insertMarkdownFormatting, countWordsAndChars } from '../utils/markdownHelpers';
import { getSlideIndexForLine } from '../utils/marpParser';

export function useEditor({ onSlideChange = null } = {}) {
  const editorViewRef = useRef(null);

  const setEditorView = useCallback((view) => {
    editorViewRef.current = view;
  }, []);

  const insertFormat = useCallback((type, payload = {}) => {
    if (editorViewRef.current) {
      insertMarkdownFormatting(editorViewRef.current, type, payload);
    }
  }, []);

  /**
   * Jumps CodeMirror scroll and cursor to the start of a given slide index
   */
  const jumpToSlide = useCallback((slideIndex, slides) => {
    const view = editorViewRef.current;
    if (!view || !slides || !slides[slideIndex]) return;

    const targetSlide = slides[slideIndex];
    const targetLineNumber = targetSlide.startLine || 1;

    try {
      const doc = view.state.doc;
      const line = doc.line(Math.min(targetLineNumber, doc.lines));
      
      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
      view.focus();
    } catch (err) {
      console.warn('[useEditor] Failed to scroll to slide line:', err);
    }
  }, []);

  /**
   * Called on CodeMirror selection/cursor update to automatically sync active slide
   */
  const handleEditorUpdate = useCallback((viewUpdate, slides) => {
    if (!viewUpdate || !viewUpdate.selectionSet || !slides || !onSlideChange) return;

    const mainSelection = viewUpdate.state.selection.main;
    const lineNumber = viewUpdate.state.doc.lineAt(mainSelection.head).number;
    const computedSlideIndex = getSlideIndexForLine(slides, lineNumber);

    onSlideChange(computedSlideIndex);
  }, [onSlideChange]);

  const getStats = useCallback((text) => {
    return countWordsAndChars(text);
  }, []);

  return {
    editorViewRef,
    setEditorView,
    insertFormat,
    jumpToSlide,
    handleEditorUpdate,
    getStats,
  };
}

export default useEditor;
