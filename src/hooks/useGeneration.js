import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePresentation, watchJob } from '../services/generationService';
import agentService from '../services/agentService';

export default function useGeneration() {
  const [pending, setPending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const controller = useRef(null);
  const active = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const run = useCallback(async (prompt, type, fields = {}, resumeId = null) => {
    if (active.current) throw new Error('A generation job is already active.');
    active.current = true;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setPending(true); setError('');
    if (!resumeId) { setEvent(null); setJobId(null); }
    try {
      const callbacks = { signal, onEvent: setEvent, onStatus: setStatus, onJob: setJobId };
      return await (resumeId ? watchJob(resumeId, callbacks) : generatePresentation(prompt, type, { ...fields, ...callbacks }));
    } catch (err) {
      if (!signal.aborted) setError(err.message);
      throw err;
    } finally {
      active.current = false;
      if (!signal.aborted) setPending(false);
    }
  }, []);
  const cancel = useCallback(async () => {
    if (!jobId) return;
    try { await agentService.cancelJob(jobId); }
    catch (err) { setError(err.message); }
  }, [jobId]);
  return { run, cancel, pending, jobId, event, status, error };
}
