import React, { useState } from 'react';
import { PanelsTopLeft, ArrowUpRight } from 'lucide-react';
import useInView from '../../hooks/useInView';
import useGeneration from '../../hooks/useGeneration';
import useSources from '../../hooks/useSources';
import GenerationVisual from '../presentation/GenerationVisual';
import SourcePicker from '../presentation/SourcePicker';

export default function CreateWithAI({ onCreate }) {
  const [sectionRef, visible] = useInView();
  const [prompt, setPrompt] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [error, setError] = useState('');
  const generation = useGeneration();
  const sources = useSources();

  const submit = async (event) => {
    event.preventDefault();
    if (!prompt.trim() || generation.pending || sources.blocked) return;
    setError('');
    try {
      const result = await generation.run(prompt.trim(), 'deck', { source_ids: sources.readyIds, options: { persist: true, slide_count: slideCount } });
      if (!result.presentation_id) throw new Error('Generation completed without a saved presentation.');
      await onCreate({ presentationId: result.presentation_id });
    } catch (reason) { setError(reason.message); }
  };

  return <section ref={sectionRef} className={`ai-create ${visible ? 'is-visible' : ''}`} aria-labelledby="ai-create-heading">
    <div className="ai-ambient-geometry" aria-hidden="true">
      <svg viewBox="0 0 960 520"><path className="ai-flow-path" d="M-40 406C142 246 278 438 426 284S668 82 1004 210" /><path className="ai-data-line" d="M550 440l38-24 34 11 42-44 38 12 52-69 44 18 58-82" /><g><circle cx="588" cy="416" r="3" /><circle cx="664" cy="383" r="3" /><circle cx="754" cy="326" r="3" /><circle cx="856" cy="262" r="3" /></g></svg>
      <span className="ai-float-slide ai-float-slide-one"><i /><i /><b /></span><span className="ai-float-slide ai-float-slide-two"><i /><i /><b /></span><span className="ai-float-slide ai-float-slide-three"><i /><i /><b /></span>
    </div>
    <div><span className="eyebrow"><PanelsTopLeft size={16} /> Create with AI</span><h2 id="ai-create-heading">From direction<br />to a complete deck.</h2><p>Describe the message and audience. The agent builds an editable first draft you can refine with precision.</p><div className="ai-prompt-ideas">{['A product launch', 'Explain a complex idea', 'A research update'].map((idea) => <button key={idea} disabled={generation.pending} onClick={() => setPrompt(idea)}>{idea}<ArrowUpRight size={13} /></button>)}</div></div>
    <form onSubmit={submit} className="ai-prompt-box" aria-busy={generation.pending}>
      {generation.pending ? <><GenerationVisual event={generation.event} /><button type="button" className="secondary-cta" onClick={generation.cancel}>Cancel generation</button></> : <>
        <label htmlFor="create-ai-prompt">What should your presentation make clear?</label>
        <textarea id="create-ai-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A five-slide introduction to sustainable design for a curious audience…" rows={5} />
        <label className="text-xs" htmlFor="ai-slide-count">Number of slides <input id="ai-slide-count" className="ml-2 w-16 rounded border px-2 py-1" type="number" min="1" max="40" required value={slideCount} onChange={(event) => setSlideCount(event.target.value === '' ? '' : Number(event.target.value))} /></label>
        <SourcePicker controller={sources} compact />
        <button className="primary-cta" disabled={!prompt.trim() || sources.blocked} type="submit"><PanelsTopLeft size={17} /> Generate presentation</button>
      </>}
      {(error || generation.error) && <p role="alert" className="ui-error">{error || generation.error}</p>}
    </form>
  </section>;
}
