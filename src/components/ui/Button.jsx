/**
 * Reusable Button Primitive
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  className = '',
  variant = 'secondary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle'
  size = 'sm', // 'xs' | 'sm' | 'md' | 'lg'
  icon: Icon = null,
  iconRight: IconRight = null,
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 disabled:pointer-events-none rounded-md select-none';

  const variants = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 shadow-sm border border-sky-600/30',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 shadow-sm',
    outline: 'bg-transparent text-slate-700 hover:bg-slate-100 border border-slate-300',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200',
    subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent',
  };

  const sizes = {
    xs: 'text-xs px-2 py-1 gap-1',
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-4 py-2.5 gap-2.5',
  };

  return (
    <button
      type={type}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight className="w-3.5 h-3.5 flex-shrink-0" /> : null}
    </button>
  );
}

export default Button;
