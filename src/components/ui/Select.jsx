/**
 * Reusable Select Dropdown Primitive
 */
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-react';

export function Select({
  label,
  value,
  onChange,
  options = [],
  className = '',
  id,
  ...props
}) {
  return (
    <div className="flex flex-col gap-1 text-left">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative inline-block">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className={twMerge(
            clsx(
              'appearance-none w-full bg-white border border-slate-200 rounded-md py-1.5 pl-3 pr-8 text-xs font-medium text-slate-800 shadow-sm cursor-pointer transition-colors',
              'focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20',
              className
            )
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

export default Select;
