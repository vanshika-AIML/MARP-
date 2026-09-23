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
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 disabled:pointer-events-none rounded-none select-none';

  const variants = {
    primary: 'bg-[#ff4757] text-white border-2 border-black hover:bg-[#ff6b81] shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
    secondary: 'bg-[#ffd32a] text-black border-2 border-black hover:bg-[#ffdd59] shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
    outline: 'bg-white text-black border-2 border-black hover:bg-gray-100 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
    ghost: 'bg-transparent text-black border-2 border-transparent hover:bg-white hover:border-black hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-x-[2px] hover:-translate-y-[2px] active:shadow-none active:translate-x-[0px] active:translate-y-[0px]',
    danger: 'bg-rose-500 text-white border-2 border-black hover:bg-rose-600 shadow-[4px_4px_0px_rgba(0,0,0,1)]',
    subtle: 'bg-[#1e90ff] text-white border-2 border-black hover:bg-[#70a1ff] shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
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
