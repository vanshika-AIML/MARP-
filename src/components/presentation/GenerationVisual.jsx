import React from 'react';

export default function GenerationVisual({ event, compact = false }) {
  const active = ['generating', 'generating_slide', 'rendering', 'outlining', 'styling'].includes(event?.type);
  const progress = active && typeof event?.progress === 'number' && Number.isFinite(event.progress)
    ? Math.max(0, Math.min(100, event.progress)) : null;
  return <div className={`making-deck ${compact ? 'making-deck-compact' : ''}`} role="status" aria-live="polite">
    <svg viewBox="0 0 240 150" className="deck-buddy" aria-hidden="true">
      <ellipse cx="120" cy="133" rx="65" ry="7" fill="currentColor" opacity=".08" />
      <g className="buddy-pages"><rect x="60" y="27" width="122" height="85" rx="6" fill="#e0f2fe" stroke="#7dd3fc" transform="rotate(-9 120 70)" />
        <rect x="57" y="30" width="122" height="85" rx="6" fill="#ede9fe" stroke="#c4b5fd" transform="rotate(7 120 70)" /></g>
      <g className="buddy-face"><rect x="56" y="34" width="128" height="88" rx="6" fill="#fff" stroke="#0284c7" strokeWidth="2" />
        <rect x="69" y="47" width="48" height="6" rx="3" fill="#bae6fd" /><rect x="69" y="60" width="28" height="4" rx="2" fill="#ddd6fe" />
        <circle cx="107" cy="84" r="4" fill="#0f172a" /><circle cx="139" cy="84" r="4" fill="#0f172a" />
        <path d="M113 96 Q123 105 133 96" fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
        <circle cx="94" cy="93" r="5" fill="#fbcfe8" /><circle cx="152" cy="93" r="5" fill="#fbcfe8" /></g>
      <g className="buddy-spark" fill="#fbbf24"><path d="m204 27 3 9 9 3-9 3-3 9-3-9-9-3 9-3z" /><path d="m33 69 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></g>
    </svg>
    <p className="font-semibold">{active && event?.message ? event.message : 'Making room for your ideas…'}</p>
    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{active && event?.slideIndex != null ? `Working on slide ${event.slideIndex + 1}` : 'Your presentation is being generated. You can stay right here.'}</p>
    {progress !== null ? <div className="real-progress" role="progressbar" aria-label="Generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /><small>{progress}%</small></div>
      : <span className="waiting-dots" aria-label="Waiting for generation"><i /><i /><i /></span>}
  </div>;
}
