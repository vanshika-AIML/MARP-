import React, { useState } from 'react';
import { PanelsTopLeft, Network, AlertCircle, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import GenerationVisual from './GenerationVisual';
import SourcePicker from './SourcePicker';
import Badge from '../ui/Badge';
import { AI_ACTIONS } from '../../services/agentService';

export function GenerationOverlay({ isOpen, onClose, wsStatus, wsEventState, onGenerate, onCancelGeneration, generationPending, generationError, sources }) {
  const [prompt, setPrompt] = useState('');
  const [action, setAction] = useState('slide');
  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!prompt.trim() || generationPending || sources.blocked) return;
    try { await onGenerate(prompt, action); setPrompt(''); onClose(); } catch { /* shared state renders error */ }
  };
  return <Modal isOpen={isOpen} onClose={generationPending ? () => {} : onClose} title="AI Presentation Assistant" subtitle="Generate and refine with live backend progress" maxWidth="max-w-md" showClose={!generationPending}>
    <div className="space-y-4">
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"><div className="flex items-center gap-2"><Network className="w-4 h-4 text-sky-600" /><span className="text-xs font-medium text-slate-700">Generation stream</span></div><Badge variant={wsStatus === 'connected' ? 'green' : wsStatus === 'reconnecting' ? 'amber' : 'slate'} dot size="xs">{wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting' : 'Ready'}</Badge></div>
      {generationPending ? <><GenerationVisual event={wsEventState} /><div className="flex justify-end"><Button variant="secondary" size="sm" icon={XCircle} type="button" onClick={onCancelGeneration}>Cancel generation</Button></div></> :
        <form onSubmit={handleGenerate} className="space-y-3.5">
          <label className="block text-xs font-medium text-slate-700">Action<select value={action} onChange={(event) => setAction(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">{AI_ACTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <Input id="generation-prompt" label="Topic or instruction" placeholder="Explain an event-driven architecture with Kafka" value={prompt} onChange={(event) => setPrompt(event.target.value)} autoFocus />
          <SourcePicker controller={sources} compact />
          {generationError && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{generationError}</span></div>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button variant="primary" size="sm" icon={PanelsTopLeft} type="submit" disabled={!prompt.trim() || sources.blocked}>Run action</Button></div>
        </form>}
    </div>
  </Modal>;
}
export default GenerationOverlay;
