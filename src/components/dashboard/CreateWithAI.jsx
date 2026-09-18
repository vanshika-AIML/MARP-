import React, { useState } from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { generatePresentation } from '../../services/generationService';
import useWebSocket from '../../hooks/useWebSocket';
import GenerationVisual from '../presentation/GenerationVisual';

export default function CreateWithAI({ onCreate }) {
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
  return <section className="ai-create" aria-labelledby="ai-create-heading">
    <div><span className="eyebrow"><Sparkles size={16} /> Create with AI</span><h2 id="ai-create-heading">A little spark.<br />A whole presentation.</h2><p>Tell the agent what you want to say. Get an editable first draft, then make it yours.</p><div className="ai-prompt-ideas">{['A product launch', 'Explain a big idea', 'A research update'].map((idea) => <button key={idea} disabled={pending} onClick={() => setPrompt(idea)}>{idea}<ArrowUpRight size={13} /></button>)}</div></div>
    <form onSubmit={submit} className="ai-prompt-box" aria-busy={pending}>
      {pending ? <GenerationVisual event={eventState !== startingEvent ? eventState : null} /> : <><label htmlFor="create-ai-prompt">What should your presentation make clear?</label><textarea id="create-ai-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A five-slide introduction to sustainable design for a curious audience…" rows={5} /><button className="primary-cta" disabled={!prompt.trim()} type="submit"><Sparkles size={17} /> Generate presentation</button></>}
      {error && <p role="alert" className="ui-error">{error}</p>}
    </form>
  </section>;
}
