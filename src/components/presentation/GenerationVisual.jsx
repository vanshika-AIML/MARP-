import React from 'react';

export default function GenerationVisual({ event, compact = false }) {
  const active = ['generating', 'generating_slide', 'rendering', 'outlining', 'styling'].includes(event?.type);
  const progress = active && typeof event?.progress === 'number' && Number.isFinite(event.progress)
    ? Math.max(0, Math.min(100, event.progress)) : null;
  const phase = progress === null ? 'indeterminate' : `phase-${Math.max(1, Math.min(4, Math.ceil(progress / 25)))}`;

  return <div className={`making-deck ${compact ? 'making-deck-compact' : ''} ${phase}`} role="status" aria-live="polite" style={progress === null ? undefined : { '--generation-progress': progress / 100 }}>
    <svg viewBox="0 0 280 170" className="deck-assembly" aria-hidden="true">
      <defs>
        <pattern id="assembly-grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="currentColor" strokeOpacity=".09" /></pattern>
        <linearGradient id="assembly-scan" x1="0" x2="1"><stop stopColor="currentColor" stopOpacity="0" /><stop offset=".5" stopColor="currentColor" stopOpacity=".42" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
      </defs>
      <rect x="1" y="1" width="278" height="168" rx="10" className="assembly-surface" />
      <rect x="1" y="1" width="278" height="168" rx="10" fill="url(#assembly-grid)" />
      <path className="assembly-trace" d="M20 130C56 130 54 72 91 72s32 51 72 51 39-76 83-76" />
      <g className="assembly-main-frame">
        <rect x="48" y="33" width="144" height="94" rx="4" />
        <path className="assembly-title" d="M65 54h58M65 65h83" />
        <path className="assembly-copy" d="M65 84h48M65 93h38M65 102h44" />
        <rect className="assembly-media" x="124" y="80" width="51" height="30" rx="2" />
        <path className="assembly-media-line" d="m129 105 13-13 8 8 8-7 12 12" />
      </g>
      <g className="assembly-thumbnail thumbnail-one"><rect x="204" y="42" width="54" height="34" rx="2" /><path d="M211 51h22M211 58h35M211 66h15" /></g>
      <g className="assembly-thumbnail thumbnail-two"><rect x="204" y="84" width="54" height="34" rx="2" /><path d="M211 93h30M211 100h18M237 102h14v9h-14z" /></g>
      <g className="assembly-thumbnail thumbnail-three"><rect x="204" y="126" width="54" height="28" rx="2" /><path d="M211 135h25M211 142h36" /></g>
      <rect className="assembly-scan" x="42" y="22" width="160" height="2" fill="url(#assembly-scan)" />
      <circle className="assembly-node node-one" cx="20" cy="130" r="3" />
      <circle className="assembly-node node-two" cx="91" cy="72" r="3" />
      <circle className="assembly-node node-three" cx="163" cy="123" r="3" />
      <circle className="assembly-node node-four" cx="246" cy="47" r="3" />
    </svg>
    <p className="font-semibold">{active && event?.message ? event.message : 'Assembling your presentation…'}</p>
    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{active && event?.slideIndex != null ? `Working on slide ${event.slideIndex + 1}` : 'Building the narrative, layout, and visual system.'}</p>
    {progress !== null ? <div className="real-progress" role="progressbar" aria-label="Generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /><small>{progress}%</small></div>
      : <span className="flowing-dots" aria-label="Waiting for generation"><i /><i /><i /></span>}
  </div>;
}
