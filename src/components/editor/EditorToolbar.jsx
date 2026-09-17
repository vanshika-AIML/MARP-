/**
 * EditorToolbar Component
 * Developer-tool styled Markdown & MARP formatting bar
 */
import React from 'react';
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  SplitSquareVertical,
  Palette,
} from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import DirectivesHelper from './DirectivesHelper';
import { THEME_REGISTRY } from '../../utils/themeRegistry';

export function EditorToolbar({
  onFormat,
  currentTheme = 'default',
  onChangeTheme,
}) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border-b border-slate-200/80 select-none overflow-x-auto">
      {/* Left Formatting Group */}
      <div className="flex items-center gap-0.5">
        {/* Headings */}
        <Tooltip text="Heading 1" shortcut="# ">
          <button
            type="button"
            onClick={() => onFormat('h1')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Heading 2" shortcut="## ">
          <button
            type="button"
            onClick={() => onFormat('h2')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Heading 3" shortcut="### ">
          <button
            type="button"
            onClick={() => onFormat('h3')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        {/* Text styling */}
        <Tooltip text="Bold" shortcut="Ctrl+B">
          <button
            type="button"
            onClick={() => onFormat('bold')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Italic" shortcut="Ctrl+I">
          <button
            type="button"
            onClick={() => onFormat('italic')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Code / Block">
          <button
            type="button"
            onClick={() => onFormat('code')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Blockquote">
          <button
            type="button"
            onClick={() => onFormat('quote')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        {/* Lists & Tables */}
        <Tooltip text="Bulleted List">
          <button
            type="button"
            onClick={() => onFormat('ul')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Numbered List">
          <button
            type="button"
            onClick={() => onFormat('ol')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Table">
          <button
            type="button"
            onClick={() => onFormat('table')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Insert Link">
          <button
            type="button"
            onClick={() => onFormat('link')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <Tooltip text="Insert Image">
          <button
            type="button"
            onClick={() => onFormat('image')}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        {/* Slide Separator */}
        <Tooltip text="New Slide Separator (---)">
          <button
            type="button"
            onClick={() => onFormat('slide-break')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors text-xs font-semibold"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>---</span>
          </button>
        </Tooltip>

        {/* Directives Helper Menu */}
        <DirectivesHelper onInsertDirective={onFormat} />
      </div>

      {/* Right: Theme Selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
          <Palette className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={currentTheme}
            onChange={(e) => onChangeTheme && onChangeTheme(e.target.value)}
            className="text-xs bg-transparent text-slate-700 font-medium cursor-pointer focus:outline-none"
          >
            {THEME_REGISTRY.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default EditorToolbar;
