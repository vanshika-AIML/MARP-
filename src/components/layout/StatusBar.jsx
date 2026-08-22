/**
 * StatusBar Component
 * Bottom application status bar with document metrics and backend connection health
 */
import React from 'react';
import { Activity, Server, Radio, FileText } from 'lucide-react';
import Badge from '../ui/Badge';

export function StatusBar({
  wordCount = 0,
  charCount = 0,
  currentSlide = 0,
  totalSlides = 1,
  theme = 'default',
  wsStatus = 'disconnected',
  apiEndpoint = 'FastAPI v1',
}) {
  return (
    <footer className="h-7 bg-white border-t border-slate-200 px-3 flex items-center justify-between text-[11px] text-slate-500 font-mono select-none z-20">
      {/* Left Metrics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-600">
          <FileText className="w-3 h-3 text-slate-400" />
          <span>{wordCount} words</span>
          <span className="text-slate-300">•</span>
          <span>{charCount} chars</span>
        </div>

        <div className="w-[1px] h-3 bg-slate-200" />

        <div className="text-slate-600">
          Slide <strong className="text-slate-800">{currentSlide + 1}</strong> of {totalSlides}
        </div>

        <div className="w-[1px] h-3 bg-slate-200" />

        <div className="capitalize text-slate-600">
          Theme: <span className="text-slate-800 font-semibold">{theme}</span>
        </div>
      </div>

      {/* Right Backend Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Server className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-500">{apiEndpoint}</span>
        </div>

        <div className="w-[1px] h-3 bg-slate-200" />

        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-slate-400" />
          <Badge
            variant={wsStatus === 'connected' ? 'green' : wsStatus === 'connecting' ? 'amber' : 'slate'}
            dot
            size="xs"
          >
            {wsStatus === 'connected' ? 'WS Live' : wsStatus === 'connecting' ? 'WS Connecting' : 'WS Offline'}
          </Badge>
        </div>
      </div>
    </footer>
  );
}

export default StatusBar;
