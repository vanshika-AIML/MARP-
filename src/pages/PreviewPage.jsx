/**
 * PreviewPage / Fullscreen Presentation View Component
 * Dedicated full-screen presentation runner with keyboard controls.
 */
import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import SlideView from '../components/presentation/SlideView';
import useHotkeys from '../hooks/useHotkeys';

export function PreviewPage({
  presentation,
  activeSlide = 0,
  onSlideChange,
  onExit,
}) {
  const slides = presentation?.slides || [];
  const [currentIdx, setCurrentIdx] = useState(activeSlide);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setCurrentIdx(activeSlide);
  }, [activeSlide]);

  const handleNext = () => {
    if (currentIdx < slides.length - 1) {
      const next = currentIdx + 1;
      setCurrentIdx(next);
      if (onSlideChange) onSlideChange(next);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prev = currentIdx - 1;
      setCurrentIdx(prev);
      if (onSlideChange) onSlideChange(prev);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  useHotkeys({
    onNextSlide: handleNext,
    onPrevSlide: handlePrev,
    onEscape: onExit,
    enabled: true,
  });

  const currentSlide = slides[currentIdx];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between items-center text-white select-none">
      {/* Floating Header Controls */}
      <div className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-b from-slate-950/90 to-transparent z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-slate-200">
            {presentation?.title || 'Presentation'}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Slide {currentIdx + 1} / {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="Exit Presentation (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      <div className="flex-1 w-full max-w-6xl p-6 flex items-center justify-center overflow-hidden">
        <div className="w-full aspect-slide shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white">
          <SlideView
            slide={currentSlide}
            theme={presentation?.theme}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Bottom Floating Navigation Toolbar */}
      <div className="w-full flex items-center justify-center gap-4 py-4 bg-gradient-to-t from-slate-950/90 to-transparent z-10">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIdx <= 0}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:pointer-events-none text-white transition-colors"
          title="Previous Slide (←)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Slide Progress Dots */}
        <div className="flex items-center gap-1.5 max-w-md overflow-x-auto px-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCurrentIdx(i);
                if (onSlideChange) onSlideChange(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIdx
                  ? 'w-6 bg-sky-400'
                  : 'w-1.5 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIdx >= slides.length - 1}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:pointer-events-none text-white transition-colors"
          title="Next Slide (→)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default PreviewPage;
