import { describe, expect, it } from 'vitest';
import { getDefaultMarpConfig, readMarpConfig, setRuntimeMarpConfig } from './marpConfig';

describe('MARP runtime configuration', () => {
  it('publishes server-loaded configuration to synchronous consumers', () => {
    const config = getDefaultMarpConfig();
    config.landing.tagline = 'A published admin tagline';
    setRuntimeMarpConfig(config);
    expect(readMarpConfig().landing.tagline).toBe('A published admin tagline');
  });

  it('contains no secret configuration fields', () => {
    const json = JSON.stringify(getDefaultMarpConfig()).toLowerCase();
    expect(json).not.toContain('apikey');
    expect(json).not.toContain('database_url');
    expect(json).not.toContain('redis_url');
  });
});
