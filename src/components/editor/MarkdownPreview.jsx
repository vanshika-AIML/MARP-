/**
 * MarkdownPreview Component
 * Renders the live slide preview in a responsive presentation viewport
 * with zoom controls, theme styling, and slide navigation.
 */
import React from 'react';
import SlideView from '../presentation/SlideView';
import PresentationControls from '../presentation/PresentationControls';

export function MarkdownPreview({
  slide,
  slides = [],
  activeSlide = 0,
  theme = 'default',
  zoom = 1.0,
  onNextSlide,
  onPrevSlide,
  onPresent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  className = '',
}) {
  return (
    <div className={`flex flex-col h-full bg-slate-100/70 relative select-none ${className}`}>
      {/* Slide Viewport Canvas */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div
          className="w-full max-w-4xl aspect-slide shadow-elevated rounded-lg overflow-hidden border border-slate-300/80 bg-white transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})` }}
        >
          <SlideView
            key={`${activeSlide}-${slide?.content?.length || 0}`}
            slide={slide || slides[activeSlide]}
            theme={theme}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Slide Navigation & Zoom Controls Bar */}
      <PresentationControls
        currentSlide={activeSlide}
        totalSlides={slides.length}
        onNext={onNextSlide}
        onPrev={onPrevSlide}
        onPresent={onPresent}
        zoom={zoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
      />
    </div>
  );
}

export default MarkdownPreview;
