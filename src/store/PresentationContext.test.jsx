import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PresentationProvider, usePresentationContext } from './PresentationContext';
import { presentationService } from '../services/presentationService';

vi.mock('../services/presentationService', () => ({
  presentationService: {
    updatePresentation: vi.fn().mockResolvedValue({}),
    getPresentation: vi.fn(),
    createPresentation: vi.fn(),
  },
}));

function Harness() {
  const { updateMarkdown } = usePresentationContext();
  return <button onClick={() => updateMarkdown('---\nmarp: true\n---\n\n# Edited')}>Edit</button>;
}

describe('PresentationProvider autosave', () => {
  it('does not save on load but saves one debounced user edit', async () => {
    vi.useFakeTimers();
    render(
      <PresentationProvider initialData={{ id: 'deck-1', title: 'Deck', theme: 'default', markdown: '# Loaded' }}>
        <Harness />
      </PresentationProvider>
    );

    await act(async () => vi.advanceTimersByTime(1300));
    expect(presentationService.updatePresentation).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole('button', { name: 'Edit' }).click();
    });
    await act(async () => vi.advanceTimersByTime(1300));
    expect(presentationService.updatePresentation).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
