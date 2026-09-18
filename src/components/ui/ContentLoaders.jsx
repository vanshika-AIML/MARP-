import React from 'react';
export function DeckSkeletons({ label = 'Loading presentations' }) {
  return <div role="status" aria-label={label} className="deck-grid"><span className="sr-only">{label}</span>{[0, 1, 2].map((item) => <div key={item} className="loading-card" aria-hidden="true"><div className="skeleton skeleton-slide"><span /><span /><i /></div><div className="skeleton h-4 w-2/3 mt-5" /><div className="skeleton h-3 w-1/3 mt-3" /></div>)}</div>;
}
export function PresentationLoading() {
  return <div className="presentation-loading" role="status"><div className="loading-deck-stack" aria-hidden="true"><div className="loading-deck-frame loading-deck-back" /><div className="loading-deck-frame loading-deck-middle" /><div className="loading-slide"><div className="skeleton h-6 w-2/3" /><div className="skeleton h-3 w-full mt-6" /><div className="skeleton h-3 w-3/4 mt-3" /><div className="loading-slide-layout"><i /><span><b /><b /><b /></span></div><div className="loading-scan" /></div></div><p>Opening your presentation<span className="flowing-dots"><i /><i /><i /></span></p></div>;
}
