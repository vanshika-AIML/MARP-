import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultMarpConfig, publishMarpConfig, readMarpConfig, readMarpDraft, saveMarpDraft } from './marpConfig';

afterEach(() => localStorage.clear());

describe('MARP admin configuration', () => {
  it('publishes a draft that user-facing readers can consume', () => {
    const config = getDefaultMarpConfig();
    config.landing.tagline = 'A published admin tagline';
    saveMarpDraft(config);
    publishMarpConfig(readMarpDraft(), 'Test Admin');
    expect(readMarpConfig().landing.tagline).toBe('A published admin tagline');
  });

  it('keeps secrets out of the product configuration shape', () => {
    const config = getDefaultMarpConfig();
    expect(config.ai).not.toHaveProperty('apiKey');
    expect(config.ai).not.toHaveProperty('secret');
  });
});
