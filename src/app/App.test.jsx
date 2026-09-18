import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

vi.mock('../services/presentationService', () => ({ presentationService: {
  getPresentation: vi.fn().mockResolvedValue({ id: 'one', title: 'Test deck', markdown: '# Test' }),
  listPresentations: vi.fn().mockResolvedValue([{ id: 'one', title: 'Test deck', markdown: '# Test' }]),
} }));
vi.mock('../hooks/useWebSocket', () => ({ default: () => ({ status: 'disconnected', eventState: {} }) }));
vi.mock('../components/layout/Workspace', () => ({ default: () => <div>Workspace</div> }));

afterEach(() => { cleanup(); window.localStorage.clear(); });

it('opens the deck dashboard from the editor and preserves the restored appearance preference', async () => {
  window.localStorage.setItem('marp-theme-mode', 'dark');
  document.documentElement.dataset.theme = 'dark';
  window.history.replaceState({}, '', '/editor/one');
  render(<App />);
  await screen.findByRole('button', { name: 'Test deck' });
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/dashboard');
  expect(await screen.findByRole('heading', { name: 'Test deck' })).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
});

it('keeps the landing page separate from dashboard content', async () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(screen.getByRole('heading', { name: /MARP Studio/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Learn with Video' })).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
  expect(await screen.findByRole('tablist', { name: 'Dashboard sections' })).toBeInTheDocument();
});

