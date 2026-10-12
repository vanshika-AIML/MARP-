/**
 * useHotkeys Hook
 * Global presentation and editor keyboard shortcuts:
 * - Ctrl+S / Cmd+S: Save presentation
 * - Ctrl+Enter: Toggle Presentation Mode / Fullscreen
 * - ArrowLeft / ArrowRight / PageUp / PageDown / Space: Slide navigation in presentation mode
 * - Escape: Exit presentation mode or close modals
 */
import { useEffect } from 'react';

export function useHotkeys({
  onSave,
  onPresent,
  onNextSlide,
  onPrevSlide,
  onEscape,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl + S: Save
      if (onSave && cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (onSave) onSave();
        return;
      }

      // Ctrl + Enter: Present
      if (onPresent && cmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        if (onPresent) onPresent();
        return;
      }

      // Escape: Close / Exit fullscreen
      if (e.key === 'Escape') {
        if (onEscape) onEscape();
        return;
      }

      // Slide navigation (when target is body or presentation overlay)
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName) || e.target.closest('[contenteditable="true"], .cm-content');

      if (!isInputFocused) {
        if (onNextSlide && (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ')) {
          e.preventDefault();
          if (onNextSlide) onNextSlide();
        } else if (onPrevSlide && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
          e.preventDefault();
          if (onPrevSlide) onPrevSlide();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onSave, onPresent, onNextSlide, onPrevSlide, onEscape]);
}

export default useHotkeys;
