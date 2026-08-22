/**
 * Reusable Micro-Tooltip Primitive
 */
import React, { useState } from 'react';

export function Tooltip({ text, children, position = 'bottom', shortcut = null }) {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && text && (
        <div
          className={`absolute z-50 pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[11px] font-medium px-2 py-1 rounded shadow-md flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 ${positionStyles[position]}`}
        >
          <span>{text}</span>
          {shortcut && (
            <kbd className="bg-slate-800 text-slate-300 px-1 py-0.2 rounded text-[9px] font-mono border border-slate-700">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
