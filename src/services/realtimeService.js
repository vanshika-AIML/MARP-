import api from './api';

const TERMINAL = new Set(['job.completed', 'job.failed', 'job.cancelled', 'source.ready', 'source.failed', 'source.deleted']);

export function subscribeResource(path, { onEvent, onStatus = () => {}, onExhausted = () => {}, maxRetries = 5 } = {}) {
  let socket;
  let timer;
  let stopped = false;
  let attempts = 0;
  let terminal = false;
  let lastEventKey = '';
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
  };
  const retry = () => {
    if (stopped || terminal) return;
    if (attempts >= maxRetries) {
      stop();
      onStatus('disconnected');
      onExhausted();
      return;
    }
    onStatus('reconnecting');
    timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000));
  };
  const connect = () => {
    if (stopped) return;
    onStatus(attempts ? 'reconnecting' : 'connecting');
    try { socket = new WebSocket(api.wsUrl(path)); } catch { retry(); return; }
    socket.onopen = () => { if (!stopped) onStatus('connected'); };
    socket.onmessage = (message) => {
      if (stopped) return;
      let event;
      try { event = JSON.parse(message.data); } catch { return; }
      if (typeof event.event !== 'string') return;
      const key = `${event.event}:${event.updated_at || ''}:${event.progress || 0}`;
      if (key === lastEventKey) return;
      lastEventKey = key;
      onEvent?.(event);
      if (TERMINAL.has(event.event)) {
        terminal = true;
        stop();
        onStatus('idle');
      }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = retry;
  };
  connect();
  return stop;
}
