/**
 * SlideThumbnail Component
 * Mini scaled preview of a slide with index badge and hover action buttons.
 */
import React from 'react';
import { clsx } from 'clsx';
import { Copy, Trash2 } from 'lucide-react';
import SlideView from './SlideView';

export function SlideThumbnail({
  slide,
  index,
  isActive,
  onClick,
  onDuplicate,
  onDelete,
  canDelete = true,
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all',
        isActive
          ? 'bg-sky-50/80 ring-2 ring-sky-500 shadow-sm'
          : 'hover:bg-slate-100/80'
      )}
    >
      {/* Slide Header with Number and Quick Actions */}
      <div className="w-full flex items-center justify-between px-1">
        <span
          className={clsx(
            'text-[11px] font-mono font-medium',
            isActive ? 'text-sky-700 font-bold' : 'text-slate-500'
          )}
        >
          {index + 1}
        </span>

        {/* Hover Quick Action Buttons */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(index);
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Duplicate Slide"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete Slide"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Mini Slide Render Frame */}
      <div className="w-full aspect-slide rounded border border-slate-200/90 shadow-xs bg-white overflow-hidden pointer-events-none text-[6px]">
        <SlideView slide={slide} showSlideNumber={false} className="origin-top-left" />
      </div>
    </div>
  );
}

export default SlideThumbnail;
