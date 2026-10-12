import { afterEach, describe, expect, it, vi } from 'vitest';
import agentService from './agentService';
import { subscribeResource } from './realtimeService';
import { generatePresentation } from './generationService';

vi.mock('./agentService', () => ({
  actionName: (value) => ({ slide: 'generate_single_slide', deck: 'generate_full_deck' }[value] || value),
  default: { createJob: vi.fn(), getJob: vi.fn(), cancelJob: vi.fn() },
}));
vi.mock('./realtimeService', () => ({ subscribeResource: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('generatePresentation', () => {
  it('keeps watching through REST when WebSockets are exhausted mid-job', async () => {
    vi.useFakeTimers();
    agentService.createJob.mockResolvedValue({ job_id: 'job-poll' });
    agentService.getJob.mockResolvedValueOnce({ status: 'running' }).mockResolvedValueOnce({ status: 'completed', result: { markdown: '# Done' } });
    subscribeResource.mockImplementation((_path, handlers) => { queueMicrotask(handlers.onExhausted); return vi.fn(); });
    const done = generatePresentation('topic', 'deck');
    await vi.advanceTimersByTimeAsync(2100);
    await expect(done).resolves.toEqual({ markdown: '# Done' });
    expect(agentService.getJob).toHaveBeenCalledTimes(2);
  });
  it('creates a job and resolves its durable completed result', async () => {
    const result = { action: 'generate_full_deck', markdown: '# Real deck', presentation_id: 'deck-1', persisted: true };
    agentService.createJob.mockResolvedValue({ job_id: 'job-1', status: 'queued' });
    agentService.getJob.mockResolvedValue({ id: 'job-1', status: 'completed', result });
    subscribeResource.mockImplementation((_path, handlers) => {
      queueMicrotask(() => handlers.onEvent({ event: 'job.completed', progress: 100, data: {} }));
      return vi.fn();
    });
    const onEvent = vi.fn();
    await expect(generatePresentation('topic', 'deck', { onEvent })).resolves.toEqual(result);
    expect(agentService.createJob).toHaveBeenCalledWith(expect.objectContaining({ action: 'generate_full_deck', prompt: 'topic' }), expect.any(Object));
    expect(subscribeResource).toHaveBeenCalledWith('/ws/jobs/job-1', expect.any(Object));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'job.completed' }));
  });

  it('surfaces sanitized failed job errors', async () => {
    agentService.createJob.mockResolvedValue({ job_id: 'job-2', status: 'queued' });
    agentService.getJob.mockResolvedValue({ id: 'job-2', status: 'failed', error: { message: 'Provider unavailable' } });
    subscribeResource.mockImplementation((_path, handlers) => {
      queueMicrotask(() => handlers.onEvent({ event: 'job.failed', progress: 20, data: {} }));
      return vi.fn();
    });
    await expect(generatePresentation('topic', 'slide')).rejects.toThrow('Provider unavailable');
  });
});
