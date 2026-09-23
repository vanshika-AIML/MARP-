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

  const jumpToSlide = useCallback((slideIndex, slides) => {
    // No-op in slide-isolated mode
  }, []);

  const handleEditorUpdate = useCallback((viewUpdate) => {
    // No-op in slide-isolated mode, but keep for extension
  }, []);

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
