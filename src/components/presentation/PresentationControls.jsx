/**
 * PresentationControls Component
 * Bottom control bar for slide preview: Next/Prev, slide index indicator,
 * zoom scaling, fullscreen presentation mode launcher.
 */
import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';

export function PresentationControls({
  currentSlide = 0,
  totalSlides = 1,
  onNext,
  onPrev,
  onPresent,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  className = '',
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 bg-white border-t border-slate-200/90 select-none ${className}`}
    >
      {/* Left: Navigation Controls */}
      <div className="flex items-center gap-1.5">
        <Tooltip text="Previous Slide" shortcut="←">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentSlide <= 0}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Tooltip>

        <span className="text-xs font-mono font-medium text-slate-700 min-w-[70px] text-center">
          {currentSlide + 1} / {totalSlides}
        </span>

        <Tooltip text="Next Slide" shortcut="→">
          <button
            type="button"
            onClick={onNext}
            disabled={currentSlide >= totalSlides - 1}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Center: Zoom Controls */}
      <div className="flex items-center gap-1 text-slate-600">
        {onZoomOut && (
          <Tooltip text="Zoom Out">
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 rounded hover:bg-slate-100 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}

        <span className="text-[11px] font-mono text-slate-500 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>

        {onZoomIn && (
          <Tooltip text="Zoom In">
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 rounded hover:bg-slate-100 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}

        {onZoomReset && zoom !== 1 && (
          <Tooltip text="Reset Zoom">
            <button
              type="button"
              onClick={onZoomReset}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Right: Fullscreen Presentation Mode */}
      <div className="flex items-center gap-2">
        <Tooltip text="Present Slide Deck" shortcut="Ctrl+Enter">
          <Button
            variant="primary"
            size="xs"
            icon={Play}
            onClick={onPresent}
            className="px-2.5 py-1 text-xs shadow-xs"
          >
            Present
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

export default PresentationControls;
