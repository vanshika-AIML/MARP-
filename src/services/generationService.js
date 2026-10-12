import agentService, { actionName } from './agentService';
import { subscribeResource } from './realtimeService';
import { readMarpConfig } from '../config/marpConfig';

export function watchJob(id, { signal, onEvent, onStatus } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;
    let pollTimer;
    let close = () => {};
    let reading = false;
    const started = Date.now();
    const finish = (error, result) => {
      if (done) return;
      done = true;
      clearTimeout(pollTimer);
      close();
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(new DOMException('Stopped watching this job.', 'AbortError'));
    const readResult = async () => {
      if (done || reading) return;
      clearTimeout(pollTimer);
      reading = true;
      try {
        const job = await agentService.getJob(id, { signal });
        if (job.status === 'completed' && job.result) finish(null, job.result);
        else if (job.status === 'cancelled') finish(new Error('Generation cancelled.'));
        else if (job.status === 'failed') finish(new Error(job.error?.message || 'Generation failed. Please retry.'));
        else if (!done) {
          const delayed = Date.now() - started > 30000;
          onEvent?.({
            event: job.current_step || (job.status === 'queued' ? 'job.queued' : 'job.started'),
            job_id: id, progress: job.progress,
            message: job.status === 'queued'
              ? (delayed ? 'Still waiting for a generation worker. You can cancel and retry.' : 'Your presentation is queued.')
              : (delayed ? 'The generation worker is still processing your request...' : 'Building your presentation...'),
            data: { status: job.status },
          });
          const waitLimit = job.status === 'queued' ? 3 * 60 * 1000 : 15 * 60 * 1000;
          if (Date.now() - started > waitLimit) {
            // Stop abandoned queue work before offering a fresh attempt.
            const finalJob = await agentService.cancelJob(id);
            if (finalJob.status === 'completed' && finalJob.result) finish(null, finalJob.result);
            else finish(new Error('Generation exceeded the waiting limit and was cancelled. Please retry.'));
          } else pollTimer = setTimeout(readResult, 2000);
        }
      } catch (error) { finish(error); }
      finally { reading = false; }
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
    // Recover missed terminal events even when a socket remains open.
    pollTimer = setTimeout(readResult, 10000);
  });
}

export async function generatePresentation(prompt, generationType = 'slide', context = {}) {
  const { signal, onEvent, onStatus, onJob, ...fields } = context;
  const accepted = await agentService.createJob({ ...fields, prompt, options: { theme: readMarpConfig().ai.defaultTheme || 'default', ...fields.options }, action: actionName(generationType) }, { signal });
  onJob?.(accepted.job_id);
  return watchJob(accepted.job_id, { signal, onEvent, onStatus });
}
