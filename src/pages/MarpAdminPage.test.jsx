import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { MarpConfigProvider } from '../context/MarpConfigContext';
import { configService } from '../services/configService';
import MarpAdminPage from './MarpAdminPage';

vi.mock('../services/configService', () => ({ configService: { load: vi.fn(), saveDraft: vi.fn(), publish: vi.fn() } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
function remote() { return { published: {}, draft: null, templates: [], themes: [], featureFlags: {}, visuals: { search_enabled: false, generation_enabled: false, preferred_strategy: 'auto', max_visuals_per_deck: 6, default_image_style: 'editorial', search_provider: 'none', generation_provider: 'none' } }; }
function mount() { return render(<MemoryRouter><ThemeProvider><MarpConfigProvider><MarpAdminPage /></MarpConfigProvider></ThemeProvider></MemoryRouter>); }

describe('MARP admin workspace', () => {
  it('loads backend configuration and publishes edits', async () => {
    configService.load.mockResolvedValue(remote());
    configService.publish.mockResolvedValue();
    mount();
    expect(await screen.findByRole('heading', { name: 'Keep the product coherent.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Landing Page' }));
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Admin controlled story' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));
    await waitFor(() => expect(configService.publish).toHaveBeenCalledWith(expect.objectContaining({ landing: expect.objectContaining({ tagline: 'Admin controlled story' }) }), expect.any(Object)));
  });
});
