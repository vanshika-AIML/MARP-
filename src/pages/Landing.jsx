import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight, CircleDot, Network, PanelsTopLeft, Presentation } from 'lucide-react';
import SiteHeader from '../components/landing/SiteHeader';
import FeatureTour from '../components/landing/FeatureTour';
import CreateWithAI from '../components/dashboard/CreateWithAI';
import useInView from '../hooks/useInView';

const steps = [
  [CircleDot, 'Idea', 'Start with a topic, a point of view, or a set of rough notes.'],
  [Network, 'Structure', 'Shape the narrative into a clear sequence your audience can follow.'],
  [PanelsTopLeft, 'Design', 'Apply a considered visual system, then refine every detail in Markdown.'],
  [Presentation, 'Present', 'Preview the finished deck, enter presentation mode, and share it with confidence.'],
];

export default function Landing({ onCreate }) {
  const [timelineRef, visible] = useInView();
  const [aiRef, aiVisible] = useInView();
  const [footerRef, footerVisible] = useInView();
  const heroRef = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const hero = heroRef.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!hero || reduceMotion) return undefined;

    const scroller = hero.closest('.landing-shell');
    const finePointer = window.matchMedia?.('(pointer: fine)').matches;
    let pointerFrame;
    let scrollFrame;
    const move = (event) => {
      if (!finePointer) return;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const bounds = hero.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) - 0.5;
        const y = ((event.clientY - bounds.top) / bounds.height) - 0.5;
        hero.style.setProperty('--hero-bg-x', `${(x * 10).toFixed(2)}px`);
        hero.style.setProperty('--hero-bg-y', `${(y * 8).toFixed(2)}px`);
        hero.style.setProperty('--hero-card-x', `${(x * -5).toFixed(2)}px`);
        hero.style.setProperty('--hero-card-y', `${(y * -4).toFixed(2)}px`);
      });
    };
    const reset = () => {
      hero.style.setProperty('--hero-bg-x', '0px');
      hero.style.setProperty('--hero-bg-y', '0px');
      hero.style.setProperty('--hero-card-x', '0px');
      hero.style.setProperty('--hero-card-y', '0px');
    };
    const scroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const top = Math.min(scroller?.scrollTop || window.scrollY, hero.offsetHeight);
        hero.style.setProperty('--hero-scroll-y', `${(top * 0.045).toFixed(2)}px`);
      });
    };
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', reset);
    (scroller || window).addEventListener('scroll', scroll, { passive: true });
    return () => {
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(scrollFrame);
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', reset);
      (scroller || window).removeEventListener('scroll', scroll);
    };
  }, []);
  const create = async () => {
    setPending(true);
    setError('');
    try { await onCreate(null); }
    catch (err) { setError(err.message); }
    finally { setPending(false); }
  };

  return <main className="landing-shell"><SiteHeader />
    <section ref={heroRef} className="landing-hero">
      <div className="hero-ambient" aria-hidden="true">
        <span className="ambient-grid" />
        <span className="ambient-glow ambient-glow-a" />
        <span className="ambient-glow ambient-glow-b" />
        <span className="hero-float-outline hero-frame-one"><i /><i /><i /></span>
        <span className="hero-float-outline hero-frame-two"><i /><i /><i /></span>
        <span className="hero-float-outline hero-frame-three"><i /><i /><i /></span>
        <svg viewBox="0 0 1200 620" className="ambient-lines">
          <path d="M-40 480C205 302 330 527 548 342S870 128 1260 248" />
          <path d="M-60 526C210 351 374 568 596 387S920 175 1260 291" />
          <circle cx="1056" cy="159" r="58" />
          <path d="M1036 159h40M1056 139v40" />
        </svg>
      </div>
      <span className="eyebrow">Presentation intelligence for clear thinking</span>
      <h1 className="hero-wordmark"><span className="hero-wordmark-mask"><span>MARP Studio</span></span></h1>
      <p className="hero-tagline">Turn ideas into<br /><em>structured presentations.</em></p>
      <p className="hero-description">AI direction, precise visual systems, and the freedom of Markdown.<br />One focused workspace from first thought to final slide.</p>
      <div className="hero-actions"><button onClick={create} disabled={pending} className="primary-cta">{pending ? 'Opening your canvas…' : 'Create Presentation'}<ArrowUpRight size={18} /></button><a href="#learn" className="text-cta">Explore the workflow <ArrowDown size={15} /></a></div>
      {error && <p role="alert" className="ui-error">{error}</p>}
      <div className="hero-system-visual" aria-hidden="true">
        <svg viewBox="0 0 1000 360" role="presentation">
          <defs>
            <linearGradient id="hero-flow" x1="0" x2="1"><stop stopColor="currentColor" stopOpacity=".12" /><stop offset=".5" stopColor="currentColor" stopOpacity=".78" /><stop offset="1" stopColor="currentColor" stopOpacity=".12" /></linearGradient>
            <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="currentColor" strokeOpacity=".08" /></pattern>
          </defs>
          <rect x="1" y="1" width="998" height="358" rx="18" className="blueprint-surface" />
          <rect x="1" y="1" width="998" height="358" rx="18" fill="url(#hero-grid)" />
          <path className="blueprint-flow" d="M90 182C180 182 205 109 292 109S405 233 505 198 630 91 722 126 805 221 910 178" stroke="url(#hero-flow)" />
          <g className="blueprint-idea"><circle cx="91" cy="182" r="27" /><circle cx="91" cy="182" r="5" /><path d="M91 145v-16M91 235v-16M54 182H38M144 182h-16" /></g>
          <g className="blueprint-structure"><rect x="258" y="71" width="96" height="76" rx="6" /><path d="M274 90h45M274 104h62M274 118h35" /><circle cx="306" cy="165" r="4" /><path d="M306 147v18m0 0-38 30m38-30 38 30" /></g>
          <g className="blueprint-slide blueprint-slide-one"><rect x="454" y="144" width="164" height="102" rx="7" /><path d="M474 169h74M474 185h105M474 210h43" /><rect x="535" y="202" width="62" height="25" rx="3" /></g>
          <g className="blueprint-slide blueprint-slide-two"><rect x="665" y="76" width="164" height="102" rx="7" /><path d="M685 99h55M685 116h119M685 132h92" /><rect x="685" y="145" width="119" height="12" rx="3" /></g>
          <g className="blueprint-present"><rect x="841" y="136" width="104" height="82" rx="6" /><path d="M862 159h54M862 174h39M893 218v26m-23 0h46" /><circle cx="920" cy="197" r="4" /></g>
        </svg>
      </div>
      <p className="hero-scroll">Idea to presentation, one system.</p>
    </section>
    <section ref={timelineRef} className={`landing-section system-journey ${visible ? 'is-visible' : ''}`}>
      <svg className="timeline-ambient-geometry" viewBox="0 0 1200 620" aria-hidden="true">
        <path className="timeline-orbit" d="M-65 420C160 170 312 238 472 386S812 552 1266 176" />
        <path className="timeline-dots" d="M84 80C224 18 330 128 446 84S692 28 820 92 1036 128 1152 58" />
        <g><circle cx="85" cy="80" r="4" /><circle cx="446" cy="84" r="4" /><circle cx="820" cy="92" r="4" /><circle cx="1152" cy="58" r="4" /></g>
        <path className="timeline-corner" d="M1080 470h58v58M1110 500h58v58" />
      </svg>
      <div className="section-heading"><span className="eyebrow">A connected workflow</span><h2>From thought to presentation.</h2><p>Four deliberate stages, designed to keep the work moving without losing control.</p></div>
      <div className="timeline-path">
        <svg viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true"><path className="system-flow-line" d="M80 40C205 8 292 72 414 40S620 8 738 40 858 72 920 40" /><path className="system-flow-tracer" d="M80 40C205 8 292 72 414 40S620 8 738 40 858 72 920 40" /></svg>
        {steps.map(([Icon, title, description], i) => <article className="timeline-step" key={title} style={{ '--i': i }}><div className="timeline-icon"><Icon size={20} strokeWidth={1.5} /></div><span className="eyebrow">0{i + 1}</span><h3>{title}</h3><p>{description}</p></article>)}
      </div>
    </section>
    <FeatureTour />
    <div ref={aiRef} className={`landing-section landing-ai-section ${aiVisible ? 'is-visible' : ''}`} id="create-ai"><CreateWithAI onCreate={onCreate} /></div>
    <footer ref={footerRef} className={`landing-footer ${footerVisible ? 'is-visible' : ''}`}><span>MARP Studio — Ideas, structured.</span><Link to="/dashboard">Open your dashboard <ArrowUpRight size={15} /></Link></footer>
  </main>;
}
