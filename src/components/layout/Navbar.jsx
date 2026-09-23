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
    <header className="h-14 bg-[#1e90ff] border-b-4 border-black flex items-center justify-between px-4 select-none z-20 shadow-[0px_4px_0px_rgba(0,0,0,1)]">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex items-center gap-2 transition-all font-black text-xs hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <div className="p-1.5 bg-white text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <Presentation className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline font-black tracking-tight text-lg text-black bg-[#ffd32a] border-2 border-black px-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]">MARP Studio</span>
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
                className="text-xs font-bold text-black bg-white border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] px-2 py-0.5 focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempTitle(title);
                  setIsEditingTitle(true);
                }}
                className="text-xs font-bold text-black bg-white border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-[#ffd32a] px-2 py-1 max-w-xs truncate transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
                title="Click to rename"
              >
                {title}
              </button>
            )}

            {/* Auto-Save Status */}
            <div className="text-[11px] text-white flex items-center gap-1 font-black bg-black px-2 py-1 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              {isSaving ? (
                <>
                  <RotateCw className="w-3 h-3 animate-spin text-[#ffd32a]" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 text-[#2ed573]" />
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
            className="text-black bg-[#ffd32a] border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-white"
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
