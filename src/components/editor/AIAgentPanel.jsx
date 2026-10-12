import React, { useState } from 'react';
import { AlertCircle, Bot, Sparkles, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import GenerationVisual from '../presentation/GenerationVisual';
import SourcePicker from '../presentation/SourcePicker';
import { AI_ACTIONS } from '../../services/agentService';

export function AIAgentPanel({ wsStatus, wsEventState, onGenerate, onCancelGeneration, generationPending, generationError, sources }) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('slide');
  const [action, setAction] = useState('rewrite_slide');
  const availableActions = AI_ACTIONS.filter(([, , scope]) => mode === 'slide' ? scope === 'slide' : scope !== 'slide');
  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!prompt.trim() || generationPending || sources.blocked) return;
    try { await onGenerate(prompt, action); setPrompt(''); } catch { /* shared state renders safe error */ }
  };
  return <section className="h-full bg-white flex flex-col overflow-y-auto">
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
      <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-sky-600" /><h2 className="text-sm font-semibold text-slate-900">AI Presentation Agent</h2><Badge variant={wsStatus === 'connected' ? 'green' : wsStatus === 'reconnecting' ? 'amber' : 'slate'} dot size="xs">{wsStatus === 'connected' ? 'Connected' : wsStatus === 'reconnecting' ? 'Reconnecting' : 'Ready'}</Badge></div>
      <p className="text-xs text-slate-500 mt-1">Generate, edit, or refine the selected slide.</p>
    </div>
    <form onSubmit={handleGenerate} className="p-5 space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="AI scope">
        {['slide', 'deck'].map((value) => <button type="button" key={value} aria-pressed={mode === value} disabled={generationPending} onClick={() => { setMode(value); setAction(value === 'slide' ? 'rewrite_slide' : 'improve_entire_deck'); }} className={`flex-1 rounded-md px-2 py-2 text-xs ${mode === value ? 'bg-white shadow-sm text-sky-700' : 'text-slate-600'}`}>{value === 'slide' ? 'Single Slide' : 'Whole Deck'}</button>)}
      </div>
      <label className="block text-xs font-medium text-slate-700">Action<select value={action} disabled={generationPending} onChange={(event) => setAction(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">{availableActions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <Input id="studio-prompt" label="Prompt" placeholder="Describe what the presentation should communicate" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={generationPending} />
      {!generationPending && <SourcePicker controller={sources} compact />}
      {generationPending && <GenerationVisual compact event={wsEventState} />}
      {generationError && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{generationError}</div>}
      {generationPending ? <Button variant="secondary" size="sm" icon={XCircle} type="button" onClick={onCancelGeneration}>Cancel generation</Button> : <Button variant="primary" size="sm" icon={Sparkles} type="submit" disabled={!prompt.trim() || sources.blocked}>{generationError ? 'Retry action' : 'Run action'}</Button>}
    </form>
  </section>;
}
export default AIAgentPanel;
