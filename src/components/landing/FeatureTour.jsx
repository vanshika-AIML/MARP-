import React from 'react';
import useInView from '../../hooks/useInView';
export default function FeatureTour() {
  const [sectionRef, visible] = useInView();
  return <section ref={sectionRef} id="learn" className={`feature-tour landing-section ${visible ? 'is-visible' : ''}`}>
    <svg className="tour-ambient-geometry" viewBox="0 0 1200 720" aria-hidden="true">
      <g className="tour-orbits"><circle cx="1044" cy="158" r="102" /><circle cx="1044" cy="158" r="68" /><circle cx="1044" cy="158" r="7" /></g>
      <path className="tour-wave" d="M-42 576C70 526 132 626 240 576S410 526 518 576 688 626 796 576 966 526 1074 576 1244 626 1340 576" />
      <path className="tour-dotted-path" d="M126 144C260 36 350 204 484 112S756 44 884 126" />
      <g className="tour-crosses"><path d="M126 130v28M112 144h28M930 476v24M918 488h24" /></g>
    </svg>
    <div className="section-heading"><span className="eyebrow">Product walkthrough</span><h2>Learn with Video</h2><p>A concise view of the complete workflow, from first draft to finished presentation.</p></div>
    <div className="tour-player">
      <video className="tour-video" controls playsInline preload="metadata" poster="/media/marp-walkthrough-poster.jpg" aria-label="MARP Studio product walkthrough">
        <source src="/media/marp-walkthrough.webm" type="video/webm" />
        <track kind="captions" src="/media/marp-walkthrough.vtt" srcLang="en" label="English" default />
        Your browser does not support video. <a href="/media/marp-walkthrough.webm">Download the walkthrough</a>.
      </video>
    </div>
    <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>A real workflow: prompt, generate, refine in Split View, choose a theme, and export. Silent walkthrough with on-screen captions.</p>
  </section>;
}
