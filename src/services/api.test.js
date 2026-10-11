import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('ApiClient', () => {
  it('normalizes the API prefix and decodes JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient('https://studio.example/api/v1');
    await expect(client.get('/health/ready')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('https://studio.example/api/v1/health/ready');
  });

  it('keeps multipart boundaries browser-managed and maps safe API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'invalid_upload', message: 'Unsupported file' } }), { status: 422, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('file', new Blob(['x']), 'x.txt');
    const client = new ApiClient('https://studio.example');
    await expect(client.post('/uploads', form)).rejects.toMatchObject({ code: 'invalid_upload', status: 422 });
    expect(fetchMock.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
  });

  it('distinguishes timeout from HTTP failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))));
    const client = new ApiClient('https://studio.example');
    const assertion = expect(client.get('/slow', { timeoutMs: 10 })).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(11);
    await assertion;
    vi.useRealTimers();
  });
});
