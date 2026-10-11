import agentService, { actionName } from './agentService';
import { subscribeResource } from './realtimeService';

export function watchJob(id, { signal, onEvent, onStatus } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;
    let close = () => {};
    const finish = (error, result) => {
      if (done) return;
      done = true;
      close();
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(new DOMException('Stopped watching this job.', 'AbortError'));
    const readResult = async () => {
      try {
        const job = await agentService.getJob(id, { signal });
        if (job.status === 'completed' && job.result) finish(null, job.result);
        else if (job.status === 'cancelled') finish(new Error('Generation cancelled.'));
        else if (job.status === 'failed') finish(new Error(job.error?.message || 'Generation failed. Please retry.'));
        else finish(new Error('Live connection was lost. Reconnect to this job to continue.'));
      } catch (error) { finish(error); }
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    close = subscribeResource(`/ws/jobs/${encodeURIComponent(id)}`, {
      onStatus,
      onEvent: (event) => {
        onEvent?.(event);
        if (['job.completed', 'job.failed', 'job.cancelled'].includes(event.event)) readResult();
      },
      onExhausted: readResult,
    });
  });
}

export async function generatePresentation(prompt, generationType = 'slide', context = {}) {
  const { signal, onEvent, onStatus, onJob, ...fields } = context;
  const accepted = await agentService.createJob({ ...fields, prompt, action: actionName(generationType) }, { signal });
  onJob?.(accepted.job_id);
  return watchJob(accepted.job_id, { signal, onEvent, onStatus });
}
