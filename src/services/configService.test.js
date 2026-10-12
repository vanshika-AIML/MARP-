import { afterEach, expect, it, vi } from 'vitest';
import api from './api';
import { configService } from './configService';
import { getDefaultMarpConfig } from '../config/marpConfig';

vi.mock('./api', () => ({ default: { put: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

it('persists new themes before referencing them and clears the published draft', async () => {
  const config = getDefaultMarpConfig();
  config.themes = [{ id: 'custom', name: 'Custom', colors: {}, isDefault: true }];
  config.templates = [{ name: 'New template', theme: 'custom', markdown: '# Hello' }];
  api.post.mockImplementation(async (path) => ({ id: path === '/themes' ? 'theme-id' : 'template-id' }));
  await configService.publish(config, getDefaultMarpConfig());
  expect(api.post.mock.calls[0][0]).toBe('/themes');
  expect(api.post).toHaveBeenCalledWith('/themes/theme-id/set-default', {});
  expect(api.post).toHaveBeenCalledWith('/templates', expect.objectContaining({ theme_id: 'theme-id' }));
  expect(api.put).toHaveBeenLastCalledWith('/admin/config/ui/draft', expect.objectContaining({ value: null }));
});
