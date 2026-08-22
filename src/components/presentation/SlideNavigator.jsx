/**
 * SlideNavigator Component
 * Sidebar list of slide thumbnails with bi-directional active slide tracking,
 * addition, deletion, and duplication.
 */
import React, { useRef, useEffect } from 'react';
import { Plus, Sparkles, Layers } from 'lucide-react';
import Button from '../ui/Button';
import SlideThumbnail from './SlideThumbnail';

export function SlideNavigator({
  slides = [],
  activeSlide = 0,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onOpenAiModal,
}) {
  const listRef = useRef(null);

  // Auto-scroll navigator when active slide changes
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeSlide];
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSlide]);

  return (
    <div className="flex flex-col h-full bg-slate-50/70 border-r border-slate-200/80 w-60 select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Layers className="w-3.5 h-3.5 text-sky-600" />
          <span>Slides</span>
          <span className="text-slate-400 font-mono font-normal">({slides.length})</span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenAiModal && (
            <button
              type="button"
              onClick={onOpenAiModal}
              className="p-1 rounded text-sky-600 hover:bg-sky-50 hover:text-sky-700 transition-colors"
              title="Generate Slide with AI"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onAddSlide()}
            className="p-1 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
            title="Add Slide (---)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thumbnails Scroll Area */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-2.5 divide-y-0"
      >
        {slides.map((slide, idx) => (
          <SlideThumbnail
            key={idx}
            slide={slide}
            index={idx}
            isActive={idx === activeSlide}
            onClick={() => onSelectSlide(idx)}
            onDuplicate={onDuplicateSlide}
            onDelete={onDeleteSlide}
            canDelete={slides.length > 1}
          />
        ))}
      </div>

      {/* Bottom Add Slide Button */}
      <div className="p-2.5 border-t border-slate-200/80 bg-white/60">
        <Button
          variant="outline"
          size="sm"
          icon={Plus}
          onClick={() => onAddSlide()}
          className="w-full justify-center text-xs py-1.5 bg-white hover:bg-slate-50"
        >
          New Slide
        </Button>
      </div>
    </div>
  );
}

export default SlideNavigator;
