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
    let stopped = false;
    let timer;
    let closeSocket = () => {};
    const stop = () => { stopped = true; clearTimeout(timer); closeSocket(); sockets.current.delete(id); };
    const poll = async () => {
      clearTimeout(timer);
      try {
        const source = await uploadService.get(id);
        if (stopped || !mounted.current) return;
        update(id, { ...source, message: source.status === 'uploaded' ? 'Waiting for the source worker. You can remove this file and retry.' : source.status });
        if (['ready', 'failed', 'deleted'].includes(source.status)) { stop(); return; }
      } catch (reason) {
        if (stopped || !mounted.current) return;
        setError(reason.message);
      }
      if (!stopped) timer = setTimeout(poll, 10000);
    };
    closeSocket = subscribeResource(`/ws/sources/${encodeURIComponent(id)}`, {
      onEvent: (event) => {
        if (stopped) return;
        update(id, { status: event.data?.status || event.event.replace('source.', ''), progress: event.progress, message: event.message, error: event.data?.error });
        clearTimeout(timer);
        if (['source.ready', 'source.failed'].includes(event.event)) poll();
        else timer = setTimeout(poll, 10000);
      },
      onExhausted: poll,
    });
    sockets.current.set(id, stop);
    timer = setTimeout(poll, 10000);
  }, [update]);

  const upload = useCallback(async (files) => {
    setError('');
    for (const file of Array.from(files || [])) {
      const temporaryId = `upload-${window.crypto.randomUUID()}`;
      setSources((current) => [...current, { id: temporaryId, original_filename: file.name, status: 'uploading', progress: 0 }]);
      try {
        const accepted = await uploadService.upload(file);
        if (!mounted.current) return;
        setSources((current) => current.map((source) => source.id === temporaryId ? { ...source, id: accepted.source_id, status: accepted.status, progress: 0 } : source));
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
  const blocked = sources.some((source) => source.status !== 'ready');
  return { sources, upload, remove, readyIds, blocked, error };
}
