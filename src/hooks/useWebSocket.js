import { useEffect, useRef, useState } from 'react';
import { subscribeResource } from '../services/realtimeService';

export default function useWebSocket(path = null, { autoConnect = true, onEvent, onExhausted } = {}) {
  const [status, setStatus] = useState('idle');
  const [eventState, setEventState] = useState(null);
  const callbacks = useRef({ onEvent, onExhausted });
  callbacks.current = { onEvent, onExhausted };
  useEffect(() => {
    setEventState(null);
    if (!path || !autoConnect) { setStatus('idle'); return undefined; }
    return subscribeResource(path, {
      onStatus: setStatus,
      onEvent: (event) => { setEventState(event); callbacks.current.onEvent?.(event); },
      onExhausted: () => callbacks.current.onExhausted?.(),
    });
  }, [path, autoConnect]);
  return { status, eventState };
}
