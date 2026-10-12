import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
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

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });
const mountState = (markdown = '# Loaded') => renderHook(() => usePresentationContext(), {
  wrapper: ({ children }) => <PresentationProvider initialData={{ id: 'deck-1', title: 'Deck', markdown }}>{children}</PresentationProvider>,
});

describe('PresentationProvider autosave', () => {
  it('flushes recent edits immediately for save/navigation and preserves subsequent edits', async () => {
    vi.useFakeTimers();
    let finish;
    presentationService.updatePresentation.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = mountState();
    act(() => result.current.updateMarkdown('# First'));
    let saving;
    await act(async () => { saving = result.current.savePresentation(); });
    act(() => result.current.updateMarkdown('# Newer'));
    await act(async () => { finish({}); await saving; });
    expect(result.current.editRevision).not.toBe(result.current.savedRevision);
    await act(async () => { await result.current.savePresentation(); });
    expect(presentationService.updatePresentation).toHaveBeenLastCalledWith('deck-1', { title: 'Deck', markdown: '# Newer' });
    expect(result.current.editRevision).toBe(result.current.savedRevision);
  });

  it('reports failed autosaves and lets the user retry', async () => {
    vi.useFakeTimers();
    presentationService.updatePresentation.mockRejectedValueOnce(new Error('Backend unavailable'));
    const { result } = mountState();
    act(() => result.current.updateMarkdown('# Changed'));
    await act(async () => vi.advanceTimersByTimeAsync(1300));
    expect(result.current.saveError).toBe('Backend unavailable');
    expect(result.current.editRevision).not.toBe(result.current.savedRevision);
    await act(async () => result.current.savePresentation());
    expect(result.current.saveError).toBeNull();
  });

  it('changes only the theme in frontmatter', () => {
    const { result } = mountState('---\nmarp: true\npaginate: false\n---\n# Theme\n\n```\ntheme: code-sample\n```');
    act(() => result.current.setTheme('gaia'));
    expect(result.current.markdown.match(/marp: true/g)).toHaveLength(1);
    expect(result.current.markdown).toContain('theme: gaia\n---');
    expect(result.current.markdown).toContain('theme: code-sample');
  });

  it('does not let a slower load replace the latest requested deck', async () => {
    let first;
    presentationService.getPresentation.mockImplementationOnce(() => new Promise((resolve) => { first = resolve; })).mockResolvedValueOnce({ id: 'second', title: 'Second', markdown: '# Second' });
    const { result } = mountState();
    let old;
    await act(async () => { old = result.current.loadPresentation('first'); await result.current.loadPresentation('second'); });
    await act(async () => { first({ id: 'first', title: 'First', markdown: '# First' }); await old; });
    expect(result.current.id).toBe('second');
  });

  it('preserves the backend creation failure for the caller', async () => {
    presentationService.createPresentation.mockRejectedValueOnce(new Error('Cannot reach backend'));
    const { result } = mountState();
    await act(async () => { await expect(result.current.createNewPresentation()).rejects.toThrow('Cannot reach backend'); });
    expect(result.current.id).toBe('deck-1');
    expect(result.current.error).toBeNull();
  });
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
