import { beforeEach, describe, expect, it } from 'vitest';
import { mockService } from './mockService';

describe('mockService.createPresentation', () => {
  beforeEach(() => localStorage.clear());

  it('creates unique IDs and does not copy template metadata', async () => {
    const template = { id: 'starter-1', title: 'Starter', theme: 'gaia', markdown: '# Starter', createdAt: 'old' };
    const first = await mockService.createPresentation(template);
    const second = await mockService.createPresentation(template);

    expect(first.id).not.toBe('starter-1');
    expect(second.id).not.toBe(first.id);
    expect(first.createdAt).not.toBe('old');
    expect((await mockService.listPresentations()).filter((item) => item.title === 'Starter')).toHaveLength(2);
  });
});
