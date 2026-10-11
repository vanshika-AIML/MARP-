import React from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';

const ACCEPT = '.pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp';

export default function SourcePicker({ controller, compact = false }) {
  const { sources, upload, remove, error } = controller;
  return <div className={compact ? 'space-y-2' : 'space-y-3'}>
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-700">
      <UploadCloud className="h-4 w-4" /> Add source files
      <input className="sr-only" type="file" multiple accept={ACCEPT} onChange={(event) => { upload(event.target.files); event.target.value = ''; }} />
    </label>
    {sources.map((source) => <div key={source.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-xs">
      <FileText className="h-4 w-4 flex-none text-sky-600" />
      <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-700">{source.original_filename}</p><p className={source.status === 'failed' ? 'text-rose-600' : 'text-slate-500'}>{source.status === 'failed' ? (source.error?.message || source.error || 'Processing failed') : (source.message || source.status)}</p></div>
      {!['ready', 'failed'].includes(source.status) && <span className="text-slate-500">{source.progress || 0}%</span>}
      <button type="button" onClick={() => remove(source.id)} aria-label={`Remove ${source.original_filename}`} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
    </div>)}
    {error && <p role="alert" className="ui-error">{error}</p>}
  </div>;
}
