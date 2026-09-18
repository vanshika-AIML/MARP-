/**
 * Reusable Card Primitive
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({
  children,
  className = '',
  onClick,
  ariaLabel,
  hoverable = false,
  selected = false,
  style,
}) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick(event);
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      style={style}
      className={twMerge(
        clsx(
          'bg-white rounded-lg border border-slate-200 shadow-xs transition-all overflow-hidden text-left',
          hoverable ? 'hover:border-slate-300 hover:shadow-md cursor-pointer' : '',
          selected ? 'border-sky-500 ring-2 ring-sky-500/20' : '',
          className
        )
      )}
    >
      {children}
    </div>
  );
}

export default Card;
