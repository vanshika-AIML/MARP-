import { expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import useHotkeys from './useHotkeys';

it('saves on Ctrl+S without swallowing unrelated editor navigation', () => {
  const onSave = vi.fn();
  renderHook(() => useHotkeys({ onSave }));
  expect(fireEvent.keyDown(window, { key: 's', ctrlKey: true })).toBe(false);
  expect(onSave).toHaveBeenCalledOnce();
  expect(fireEvent.keyDown(document.body, { key: 'ArrowRight' })).toBe(true);
});

it('does not steal space from focused buttons or editable content', () => {
  const onNextSlide = vi.fn();
  renderHook(() => useHotkeys({ onNextSlide }));
  const button = document.createElement('button');
  document.body.append(button);
  fireEvent.keyDown(button, { key: ' ' });
  expect(onNextSlide).not.toHaveBeenCalled();
  button.remove();
});
