import { describe, expect, it } from 'vitest';
import { shouldUseMockFallback } from './fallback';

describe('shouldUseMockFallback', () => {
  it('allows network and timeout failures', () => {
    expect(shouldUseMockFallback({ isNetworkError: true })).toBe(true);
    expect(shouldUseMockFallback({ isTimeout: true })).toBe(true);
  });

  it('does not hide HTTP application errors', () => {
    expect(shouldUseMockFallback({ status: 401 })).toBe(false);
    expect(shouldUseMockFallback({ status: 422 })).toBe(false);
    expect(shouldUseMockFallback({ status: 500 })).toBe(false);
  });
});
