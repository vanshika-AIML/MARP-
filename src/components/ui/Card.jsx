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
  hoverable = false,
  selected = false,
}) {
  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          'bg-white rounded-none border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all overflow-hidden text-left',
          hoverable ? 'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer' : '',
          selected ? 'bg-[#ffd32a]' : '',
          className
        )
      )}
    >
      {children}
    </div>
  );
}

export default Card;
