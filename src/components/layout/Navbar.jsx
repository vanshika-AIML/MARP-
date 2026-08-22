/**
 * Navbar Component
 * Header navigation bar with inline title editing, view mode switches,
 * AI slide generation modal trigger, export options, and presentation actions.
 */
import React, { useState } from 'react';
import {
  Presentation,
  Sparkles,
  Download,
  LayoutGrid,
  Columns,
  Code2,
  Eye,
  Check,
  RotateCw,
  FolderOpen,
  Plus,
} from 'lucide-react';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import Tabs from '../ui/Tabs';

export function Navbar({
  title = 'Untitled Presentation',
  onTitleChange,
  isSaving = false,
  viewMode = 'split',
  onViewModeChange,
  onOpenAiModal,
  onOpenExportModal,
  onOpenDashboard,
  onNewDeck,
  activePage = 'editor',
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim() && onTitleChange) {
      onTitleChange(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
  };

  const viewTabs = [
    { id: 'split', label: 'Split View', icon: Columns },
    { id: 'editor', label: 'Editor', icon: Code2 },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <header className="h-12 bg-white border-b border-slate-200/90 flex items-center justify-between px-3.5 select-none z-20">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex items-center gap-2 text-slate-800 hover:text-sky-600 transition-colors font-semibold text-xs"
        >
          <div className="p-1.5 bg-sky-50 text-sky-600 rounded-md border border-sky-200/60">
            <Presentation className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline font-bold tracking-tight">MARP Studio</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200" />

        {/* Dashboard Catalog Button */}
        <Tooltip text="Browse Presentations & Templates">
          <Button
            variant={activePage === 'dashboard' ? 'subtle' : 'ghost'}
            size="xs"
            icon={LayoutGrid}
            onClick={onOpenDashboard}
          >
            Dashboard
          </Button>
        </Tooltip>

        {/* Editable Title */}
        {activePage === 'editor' && (
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                autoFocus
                className="text-xs font-semibold text-slate-900 bg-slate-100 border border-sky-400 rounded px-2 py-0.5 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempTitle(title);
                  setIsEditingTitle(true);
                }}
                className="text-xs font-semibold text-slate-900 hover:bg-slate-100 px-2 py-1 rounded max-w-xs truncate transition-colors"
                title="Click to rename"
              >
                {title}
              </button>
            )}

            {/* Auto-Save Status */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              {isSaving ? (
                <>
                  <RotateCw className="w-3 h-3 animate-spin text-sky-600" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Saved</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Center: View Layout Switcher */}
      {activePage === 'editor' && (
        <div className="hidden md:flex items-center">
          <Tabs
            tabs={viewTabs}
            activeTab={viewMode}
            onChange={onViewModeChange}
          />
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {onNewDeck && (
          <Button
            variant="outline"
            size="xs"
            icon={Plus}
            onClick={onNewDeck}
            className="hidden sm:inline-flex"
          >
            New Deck
          </Button>
        )}

        {onOpenAiModal && activePage === 'editor' && (
          <Button
            variant="secondary"
            size="xs"
            icon={Sparkles}
            onClick={onOpenAiModal}
            className="text-sky-700 bg-sky-50/70 border-sky-200/80 hover:bg-sky-100"
          >
            AI Agent
          </Button>
        )}

        {onOpenExportModal && (
          <Button
            variant="primary"
            size="xs"
            icon={Download}
            onClick={onOpenExportModal}
            className="shadow-2xs"
          >
            Export
          </Button>
        )}
      </div>
    </header>
  );
}

export default Navbar;
