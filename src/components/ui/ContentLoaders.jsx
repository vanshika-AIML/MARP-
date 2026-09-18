import React from 'react';
export function DeckSkeletons({ label = 'Loading presentations' }) {
  return <div role="status" aria-label={label} className="deck-grid"><span className="sr-only">{label}</span>{[0, 1, 2].map((item) => <div key={item} className="loading-card" aria-hidden="true"><div className="skeleton aspect-video" /><div className="skeleton h-4 w-2/3 mt-5" /><div className="skeleton h-3 w-1/3 mt-3" /></div>)}</div>;
}
export function PresentationLoading() {
  return <div className="presentation-loading" role="status"><div className="loading-slide" aria-hidden="true"><div className="skeleton h-6 w-2/3" /><div className="skeleton h-3 w-full mt-6" /><div className="skeleton h-3 w-3/4 mt-3" /><div className="loading-slide-bars"><i /><i /><i /></div></div><p>Opening your presentation<span className="waiting-dots"><i /><i /><i /></span></p></div>;
}
