import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { MarpConfigProvider } from '../context/MarpConfigContext';
import MarpAdminPage from './MarpAdminPage';

afterEach(() => { cleanup(); localStorage.clear(); });

function mount() {
  return render(<MemoryRouter><ThemeProvider><MarpConfigProvider><MarpAdminPage /></MarpConfigProvider></ThemeProvider></MemoryRouter>);
}

describe('MARP admin workspace', () => {
  it('renders protected admin navigation and publishes landing edits', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Keep the product coherent.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Landing Page' }));
    const input = screen.getByLabelText('Tagline');
    fireEvent.change(input, { target: { value: 'Admin controlled story' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));
    expect(JSON.parse(localStorage.getItem('marp-admin-config-v1')).landing.tagline).toBe('Admin controlled story');
  });
});
