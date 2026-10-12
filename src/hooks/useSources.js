import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadService } from '../services/uploadService';
import { subscribeResource } from '../services/realtimeService';

export default function useSources() {
  const [sources, setSources] = useState([]);
  const [error, setError] = useState('');
  const sockets = useRef(new Map());
  const mounted = useRef(true);
  useEffect(() => { const connections = sockets.current; mounted.current = true; return () => { mounted.current = false; for (const close of connections.values()) close(); connections.clear(); }; }, []);

  const update = useCallback((id, values) => {
    setSources((current) => current.map((source) => source.id === id ? { ...source, ...values } : source));
  }, []);

  const watch = useCallback((id) => {
    sockets.current.get(id)?.();
    const close = subscribeResource(`/ws/sources/${encodeURIComponent(id)}`, {
      onEvent: async (event) => {
        update(id, { status: event.data?.status || event.event.replace('source.', ''), progress: event.progress, message: event.message, error: event.data?.error });
        if (['source.ready', 'source.failed'].includes(event.event)) {
          try { update(id, await uploadService.get(id)); } catch { /* durable state is retried by the user */ }
          sockets.current.delete(id);
        }
      },
      onExhausted: () => {
        let stopped = false;
        let timer;
        sockets.current.set(id, () => { stopped = true; clearTimeout(timer); });
        const poll = async () => {
          try {
            const source = await uploadService.get(id);
            if (stopped || !mounted.current) return;
            update(id, source);
            if (['ready', 'failed', 'deleted'].includes(source.status)) sockets.current.delete(id);
            else timer = setTimeout(poll, 2000);
          } catch (reason) {
            if (stopped || !mounted.current) return;
            setError(reason.message);
            timer = setTimeout(poll, 5000);
          }
        };
        poll();
      },
    });
    sockets.current.set(id, close);
  }, [update]);

  const upload = useCallback(async (files) => {
    setError('');
    for (const file of Array.from(files || [])) {
      const temporaryId = `upload-${window.crypto.randomUUID()}`;
      setSources((current) => [...current, { id: temporaryId, original_filename: file.name, status: 'uploading', progress: 0 }]);
      try {
        const accepted = await uploadService.upload(file);
        if (!mounted.current) return;
        setSources((current) => current.map((source) => source.id === temporaryId ? { ...source, id: accepted.source_id, status: accepted.status, progress: 5 } : source));
        watch(accepted.source_id);
      } catch (reason) {
        update(temporaryId, { status: 'failed', error: reason.message });
      }
    }
  }, [update, watch]);

  const remove = useCallback(async (id) => {
    try {
    if (!id.startsWith('upload-')) await uploadService.delete(id);
    sockets.current.get(id)?.();
    sockets.current.delete(id);
    setSources((current) => current.filter((source) => source.id !== id));
    } catch (reason) { setError(reason.message); }
  }, []);

  const readyIds = sources.filter((source) => source.status === 'ready').map((source) => source.id);
  const blocked = sources.some((source) => !['ready', 'failed'].includes(source.status));
  return { sources, upload, remove, readyIds, blocked, error };
}
