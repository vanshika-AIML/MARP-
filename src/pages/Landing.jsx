import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Lightbulb, MessageSquare, Layers, Palette, Presentation } from 'lucide-react';
import SiteHeader from '../components/landing/SiteHeader';
import FeatureTour from '../components/landing/FeatureTour';
import CreateWithAI from '../components/dashboard/CreateWithAI';
import useInView from '../hooks/useInView';
const steps = [
  [Lightbulb, 'Have a little idea', 'A topic, a question, a few messy notes. That is plenty.'],
  [MessageSquare, 'Tell us the story', 'Who is it for? What should they remember?'],
  [Layers, 'Watch it take shape', 'Your agent turns the idea into an editable draft.'],
  [Palette, 'Make it feel like you', 'Pick a theme. Tweak the words. Add your own details.'],
  [Presentation, 'Take the stage', 'Preview, present, and share your next big thing.'],
];
export default function Landing({ onCreate }) {
  const [timelineRef, visible] = useInView();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const create = async () => { setPending(true); setError(''); try { await onCreate(null); } catch (err) { setError(err.message); } finally { setPending(false); } };
  return <main className="landing-shell"><SiteHeader />
    <section className="landing-hero">
      <div className="hero-ambient" aria-hidden="true"><span className="ambient-orbit" /><span className="ambient-star">✦</span><span className="ambient-disc" /><svg viewBox="0 0 200 130" className="ambient-doodle"><path d="M10 110C140 130 5 5 140 25s-50 95 40 75" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></div>
      <span className="eyebrow">A little idea. A big impression.</span><h1 className="hero-wordmark">MARP Studio<span className="hero-period">.</span></h1>
      <p className="hero-tagline">From a blank page<br />to a <em>clear story.</em></p><p className="hero-description">AI direction, beautiful slides, and the freedom of Markdown.<br />All in one playful workspace.</p>
      <div className="hero-actions"><button onClick={create} disabled={pending} className="primary-cta">{pending ? 'Opening your canvas…' : 'Create Presentation'}<ArrowUpRight size={18} /></button><a href="#learn" className="text-cta">Take a little tour <span>↘</span></a></div>{error && <p role="alert" className="ui-error">{error}</p>}
      <div className="hero-deck" aria-hidden="true"><div className="hero-mini mini-one"><small>A FRESH PERSPECTIVE</small><strong>Ideas worth<br />sharing.</strong><span>01 — THE SPARK</span></div><div className="hero-mini mini-two"><small>MADE WITH MARP STUDIO</small><strong>Make your<br /><em>next move.</em></strong><span>✦</span></div><div className="hero-mini mini-three"><small>ROOM TO THINK</small><strong>Simple.<br />But never boring.</strong><span>● ● ●</span></div></div>
      <p className="hero-scroll">Keep scrolling. It gets good. <span>↓</span></p>
    </section>
    <section ref={timelineRef} className={`landing-section playful-timeline ${visible ? 'is-visible' : ''}`}><div className="section-heading"><span className="eyebrow">No blank-page panic</span><h2>Big ideas. Five little steps.</h2><p>You bring the spark. We help you find the story.</p></div><div className="timeline-path">{steps.map(([Icon, title, description], i) => <article className="timeline-step" key={title} style={{ '--i': i }}><div className="timeline-icon"><Icon size={26} /></div><span className="eyebrow">0{i + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <FeatureTour /><div className="landing-section" id="create-ai"><CreateWithAI onCreate={onCreate} /></div>
    <footer className="landing-footer"><span>MARP Studio — Make something worth sharing.</span><Link to="/dashboard">Open your dashboard <ArrowUpRight size={15} /></Link></footer>
  </main>;
}

