/**
 * Reusable Status & Metadata Badge Primitive
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Badge({
  children,
  variant = 'slate', // 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'purple'
  size = 'sm', // 'xs' | 'sm' | 'md'
  dot = false,
  className = '',
}) {
  const variants = {
    slate: 'bg-white text-black',
    blue: 'bg-[#1e90ff] text-white',
    green: 'bg-[#2ed573] text-black',
    amber: 'bg-[#ffa502] text-black',
    rose: 'bg-[#ff4757] text-white',
    purple: 'bg-[#5352ed] text-white',
  };

  const dotColors = {
    slate: 'bg-black',
    blue: 'bg-white animate-pulse',
    green: 'bg-black',
    amber: 'bg-black animate-pulse',
    rose: 'bg-white',
    purple: 'bg-white',
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-bold rounded-none border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] select-none',
          variants[variant],
          sizes[size],
          className
        )
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
}

export default Badge;
