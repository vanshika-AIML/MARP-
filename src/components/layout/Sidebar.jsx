/**
 * Sidebar Component
 * Collapsible container wrapping the SlideNavigator
 */
import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import SlideNavigator from '../presentation/SlideNavigator';

export function Sidebar({
  isOpen = true,
  onToggle,
  slides = [],
  activeSlide = 0,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onOpenAiModal,
}) {
  return (
    <aside className="relative flex-shrink-0 flex">
      {isOpen ? (
        <div className="relative h-full">
          <SlideNavigator
            slides={slides}
            activeSlide={activeSlide}
            onSelectSlide={onSelectSlide}
            onAddSlide={onAddSlide}
            onDuplicateSlide={onDuplicateSlide}
            onDeleteSlide={onDeleteSlide}
            onOpenAiModal={onOpenAiModal}
          />
          {/* Collapse Button */}
          <button
            type="button"
            onClick={onToggle}
            className="absolute -right-3 top-3 z-30 p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-700 shadow-xs transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-2 border-r border-slate-200 bg-slate-50 flex flex-col items-center">
          <Tooltip text="Expand Slide Navigator" position="right">
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
