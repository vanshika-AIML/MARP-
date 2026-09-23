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
              'appearance-none w-full bg-white border-2 border-black rounded-none py-1.5 pl-3 pr-8 text-xs font-bold text-black shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer transition-all',
              'focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_rgba(0,0,0,1)]',
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
