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
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const dotColors = {
    slate: 'bg-slate-400',
    blue: 'bg-sky-500 animate-pulse',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500 animate-pulse',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
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
          'inline-flex items-center font-medium rounded-full border border-solid select-none',
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
