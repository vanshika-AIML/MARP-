import React, { useState } from 'react';
import { PanelsTopLeft, ArrowUpRight } from 'lucide-react';
import { generatePresentation } from '../../services/generationService';
import useWebSocket from '../../hooks/useWebSocket';
import useInView from '../../hooks/useInView';
import GenerationVisual from '../presentation/GenerationVisual';

export default function CreateWithAI({ onCreate }) {
  const [sectionRef, visible] = useInView();
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { eventState } = useWebSocket(null, { autoConnect: pending });
  const [startingEvent, setStartingEvent] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    if (!prompt.trim() || pending) return;
    setStartingEvent(eventState);
    setPending(true);
    setError('');
    try {
      const markdown = await generatePresentation(prompt.trim(), 'deck');
      await onCreate({ title: prompt.trim().slice(0, 100), markdown });
    } catch (err) { setError(err.message || 'Could not create your presentation. Please try again.'); }
    finally { setPending(false); }
  };
  return <section ref={sectionRef} className={`ai-create ${visible ? 'is-visible' : ''}`} aria-labelledby="ai-create-heading">
    <div className="ai-ambient-geometry" aria-hidden="true">
      <svg viewBox="0 0 960 520"><path className="ai-flow-path" d="M-40 406C142 246 278 438 426 284S668 82 1004 210" /><path className="ai-data-line" d="M550 440l38-24 34 11 42-44 38 12 52-69 44 18 58-82" /><g><circle cx="588" cy="416" r="3" /><circle cx="664" cy="383" r="3" /><circle cx="754" cy="326" r="3" /><circle cx="856" cy="262" r="3" /></g></svg>
      <span className="ai-float-slide ai-float-slide-one"><i /><i /><b /></span>
      <span className="ai-float-slide ai-float-slide-two"><i /><i /><b /></span>
      <span className="ai-float-slide ai-float-slide-three"><i /><i /><b /></span>
    </div>
    <div><span className="eyebrow"><PanelsTopLeft size={16} /> Create with AI</span><h2 id="ai-create-heading">From direction<br />to a complete deck.</h2><p>Describe the message and audience. The agent builds an editable first draft you can refine with precision.</p><div className="ai-prompt-ideas">{['A product launch', 'Explain a complex idea', 'A research update'].map((idea) => <button key={idea} disabled={pending} onClick={() => setPrompt(idea)}>{idea}<ArrowUpRight size={13} /></button>)}</div></div>
    <form onSubmit={submit} className="ai-prompt-box" aria-busy={pending}>
      {pending ? <GenerationVisual event={eventState !== startingEvent ? eventState : null} /> : <><label htmlFor="create-ai-prompt">What should your presentation make clear?</label><textarea id="create-ai-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A five-slide introduction to sustainable design for a curious audience…" rows={5} /><button className="primary-cta" disabled={!prompt.trim()} type="submit"><PanelsTopLeft size={17} /> Generate presentation</button></>}
      {error && <p role="alert" className="ui-error">{error}</p>}
    </form>
  </section>;
}
