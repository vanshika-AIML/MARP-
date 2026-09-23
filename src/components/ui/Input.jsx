/**
 * Reusable Input Primitive
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon = null,
  error = null,
  className = '',
  id,
  ...props
}) {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-2.5 text-slate-400 pointer-events-none flex items-center">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={twMerge(
            clsx(
              'w-full bg-white border-2 border-black rounded-none py-1.5 text-xs font-bold text-black placeholder:text-gray-500 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all',
              'focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_rgba(0,0,0,1)]',
              Icon ? 'pl-8 pr-3' : 'px-3',
              error ? 'border-rose-500 bg-rose-50' : '',
              className
            )
          )}
          {...props}
        />
      </div>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  );
}

export default Input;
