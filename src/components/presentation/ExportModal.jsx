/**
 * ExportModal Component
 * Provides options to export presentation to HTML, Markdown, PDF, and PPTX.
 */
import React, { useState } from 'react';
import { FileCode, FileText, Printer, Presentation, Check, Download } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { downloadMarkdownFile, downloadHtmlPresentation, triggerPrintToPdf } from '../../utils/exportHelpers';
import { presentationService } from '../../services/presentationService';

export function ExportModal({
  isOpen,
  onClose,
  presentation,
}) {
  const [exportFormat, setExportFormat] = useState('html');
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleExport = async () => {
    if (!presentation) return;
    setIsExporting(true);
    setSuccessMsg(null);

    try {
      if (exportFormat === 'markdown') {
        downloadMarkdownFile(presentation.title, presentation.markdown);
        setSuccessMsg('Markdown file downloaded successfully!');
      } else if (exportFormat === 'html') {
        // Collect slide HTML
        const slideNodes = presentation.slides.map((s, idx) => {
          return `<div class="slide-page marp-theme-${presentation.theme || 'default'}">${s.content}</div>`;
        }).join('\n');
        downloadHtmlPresentation(presentation.title, slideNodes, presentation.theme);
        setSuccessMsg('Portable HTML presentation downloaded!');
      } else if (exportFormat === 'pdf') {
        onClose();
        setTimeout(() => {
          triggerPrintToPdf();
        }, 300);
        return;
      } else if (exportFormat === 'pptx') {
        await presentationService.exportPresentation(presentation.id, 'pptx');
        setSuccessMsg('PPTX generated and dispatched!');
      }

      setTimeout(() => {
        setIsExporting(false);
        onClose();
        setSuccessMsg(null);
      }, 1200);
    } catch (err) {
      console.error('Export failed:', err);
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      id: 'html',
      title: 'HTML Presentation',
      description: 'Self-contained standalone HTML presentation with themes.',
      icon: FileCode,
    },
    {
      id: 'markdown',
      title: 'MARP Markdown (.md)',
      description: 'Raw Markdown file compatible with Marp CLI and VS Code.',
      icon: FileText,
    },
    {
      id: 'pdf',
      title: 'Print / Save as PDF',
      description: 'Opens native print dialog with 16:9 slide-per-page CSS pagination.',
      icon: Printer,
    },
    {
      id: 'pptx',
      title: 'PowerPoint (.pptx)',
      description: 'Converts deck via backend presentationService for PowerPoint.',
      icon: Presentation,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Presentation"
      subtitle={`Choose your preferred export format for "${presentation?.title || 'Presentation'}"`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {exportOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = exportFormat === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setExportFormat(opt.id)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`p-2 rounded-md ${
                    isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-900">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.description}</div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-sky-600 self-center" />}
              </button>
            );
          })}
        </div>

        {successMsg && (
          <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-200 text-center font-medium">
            {successMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            onClick={handleExport}
            loading={isExporting}
          >
            Export Now
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ExportModal;
