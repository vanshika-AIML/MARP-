/**
 * Reusable Spinner & Progress Ring Primitive
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2 className={`animate-spin text-sky-600 ${sizes[size]} ${className}`} />
  );
}

export function ProgressBar({ progress = 0, statusText = '', className = '' }) {
  const clamped = Math.max(0, Math.min(progress, 100));

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {statusText && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-600 font-medium truncate">{statusText}</span>
          <span className="text-slate-900 font-mono text-[11px] font-semibold">{clamped}%</span>
        </div>
      )}
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
        <div
          className="bg-sky-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default Spinner;
