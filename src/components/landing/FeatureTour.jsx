import React, { useEffect, useState } from 'react';
import { Play, Pause, ArrowRight } from 'lucide-react';
import useInView from '../../hooks/useInView';
const chapters = [
  ['Start your story', 'Create a blank deck, pick one of 24 themes, or import your own MARP Markdown template.', 'Choose a starting point', ['Blank deck', 'Templates', 'Upload Markdown']],
  ['Meet your AI agent', 'Describe your audience and idea. Generate one slide or a full deck. Live status comes from your backend.', 'An idea becomes a first draft', ['Your prompt', 'AI generation', 'Editable slides']],
  ['Write, design, preview', 'Use Editor for Markdown, Split for visual design with the agent, and Preview for the presentation canvas.', 'Three views. One story.', ['Editor', 'Split', 'Preview']],
  ['Make every slide yours', 'Change themes and directives, format text, add images, lists, tables, quotes, or code. See the result in every thumbnail.', 'Design that travels with your words', ['Typography', '24 themes', 'Rich content']],
  ['Keep your flow', 'Add, duplicate, delete, and navigate slides. Edits autosave after a short pause; the header shows when a save is in progress.', 'Less housekeeping. More creating.', ['Slide navigation', 'Duplicate & reorder your ideas', 'Autosave']],
  ['Present and share', 'Use fullscreen presentation mode, keyboard navigation, and zoom. Export through your connected backend.', 'Ready for your audience', ['Present', 'Navigate', 'Export']],
];
export default function FeatureTour() {
  const [sectionRef, visible] = useInView();
  const [chapter, setChapter] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const stop = () => { if (media?.matches) setPlaying(false); };
    media?.addEventListener?.('change', stop);
    if (!playing || media?.matches) return () => media?.removeEventListener?.('change', stop);
    const timer = setTimeout(() => { if (chapter === chapters.length - 1) setPlaying(false); else setChapter(chapter + 1); }, 6500);
    return () => { clearTimeout(timer); media?.removeEventListener?.('change', stop); };
  }, [chapter, playing]);
  const current = chapters[chapter];
  return <section ref={sectionRef} id="learn" className={`feature-tour landing-section ${visible ? 'is-visible' : ''}`}>
    <svg className="tour-ambient-geometry" viewBox="0 0 1200 720" aria-hidden="true">
      <g className="tour-orbits"><circle cx="1044" cy="158" r="102" /><circle cx="1044" cy="158" r="68" /><circle cx="1044" cy="158" r="7" /></g>
      <path className="tour-wave" d="M-42 576C70 526 132 626 240 576S410 526 518 576 688 626 796 576 966 526 1074 576 1244 626 1340 576" />
      <path className="tour-dotted-path" d="M126 144C260 36 350 204 484 112S756 44 884 126" />
      <g className="tour-crosses"><path d="M126 130v28M112 144h28M930 476v24M918 488h24" /></g>
    </svg>
    <div className="section-heading"><span className="eyebrow">Product walkthrough</span><h2>Learn with Video</h2><p>A concise view of the complete workflow, from first draft to finished presentation.</p></div>
    <div className="tour-player">
      <div className="tour-stage" key={chapter}><span className="tour-kicker">MARP STUDIO / CHAPTER 0{chapter + 1}</span><h3>{current[2]}</h3><div className="tour-tiles">{current[3].map((label, i) => <div key={label} style={{ '--i': i }}><span>0{i + 1}</span><strong>{label}</strong><div className="tour-lines"><i /><i /><i /></div></div>)}</div><p>{current[1]}</p></div>
      <div className="tour-controls"><button className="tour-play" onClick={() => { if (!playing && chapter === chapters.length - 1) setChapter(0); setPlaying(!playing); }} aria-label={playing ? 'Pause feature tour' : 'Play feature tour'}>{playing ? <Pause size={19} /> : <Play size={19} />}</button><span>{current[0]}</span><span className="tour-count">{chapter + 1} / {chapters.length}</span><button aria-label="Next chapter" disabled={chapter === chapters.length - 1} onClick={() => setChapter(chapter + 1)}><ArrowRight size={20} /></button></div>
    </div>
    <div className="tour-chapters" aria-label="Tour chapters">{chapters.map(([title], i) => <button key={title} aria-pressed={i === chapter} onClick={() => { setChapter(i); setPlaying(false); }}><span>0{i + 1}</span>{title}</button>)}</div>
  </section>;
}
