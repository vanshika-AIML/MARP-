/**
 * DirectivesHelper Component
 * Dropdown menu for quickly inserting MARP presentation directives
 */
import React, { useState, useRef, useEffect } from 'react';
import { Sliders, Check } from 'lucide-react';
import Tooltip from '../ui/Tooltip';

export function DirectivesHelper({ onInsertDirective }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const directivesList = [
    {
      id: 'lead',
      label: 'Lead Slide (Centered Hero)',
      snippet: 'directive-theme',
      payload: { className: 'lead' },
      description: '<!-- _class: lead -->',
    },
    {
      id: 'invert',
      label: 'Invert Slide (Dark Mode)',
      snippet: 'directive-theme',
      payload: { className: 'invert' },
      description: '<!-- _class: invert -->',
    },
    {
      id: 'bg-dark',
      label: 'Dark Navy Background',
      snippet: 'directive-bg',
      payload: { color: '#0f172a' },
      description: '<!-- _backgroundColor: #0f172a -->',
    },
    {
      id: 'bg-blue',
      label: 'Accent Blue Background',
      snippet: 'directive-bg',
      payload: { color: '#0284c7' },
      description: '<!-- _backgroundColor: #0284c7 -->',
    },
    {
      id: 'paginate',
      label: 'Enable Slide Number',
      snippet: 'directive-paginate',
      payload: {},
      description: '<!-- paginate: true -->',
    },
    {
      id: 'header',
      label: 'Add Slide Header',
      snippet: 'directive-header',
      payload: { header: 'MARP Presentation' },
      description: '<!-- header: "..." -->',
    },
    {
      id: 'footer',
      label: 'Add Slide Footer',
      snippet: 'directive-footer',
      payload: { footer: 'Confidential' },
      description: '<!-- footer: "..." -->',
    },
  ];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Tooltip text="MARP Directives">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            isOpen ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-sky-600" />
          <span>Directives</span>
        </button>
      </Tooltip>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Marp Directives
          </div>
          {directivesList.map((dir) => (
            <button
              key={dir.id}
              type="button"
              onClick={() => {
                onInsertDirective(dir.snippet, dir.payload);
                setIsOpen(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex flex-col text-left transition-colors"
            >
              <span className="font-medium text-slate-800">{dir.label}</span>
              <span className="text-[10px] font-mono text-slate-400">{dir.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DirectivesHelper;
