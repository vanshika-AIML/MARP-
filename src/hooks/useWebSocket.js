/**
 * useWebSocket Hook
 * Manages real-time WebSocket connection to FastAPI backend for AI generation lifecycle events.
 * Events handled:
 * - connecting
 * - connected
 * - generating
 * - generating_slide
 * - rendering
 * - completed
 * - error
 * - disconnected
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_WS_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export function useWebSocket(customUrl = null, options = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 3,
    reconnectInterval = 3000,
    onMessage = null,
    onEvent = null,
  } = options;

  const [status, setStatus] = useState('disconnected'); // 'disconnected'|'connecting'|'connected'|'error'
  const [lastMessage, setLastMessage] = useState(null);
  const [eventState, setEventState] = useState({
    type: 'idle', // 'generating' | 'generating_slide' | 'rendering' | 'completed' | 'error'
    progress: 0,
    message: '',
    slideIndex: null,
    payload: null,
  });

  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  const wsUrl = (customUrl || DEFAULT_WS_URL).replace(/\/+$/, '') + '/ws/generation';

  const handleSocketMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      setLastMessage(data);

      if (onMessage) onMessage(data);

      // Standardized WebSocket Event Protocol
      // e.g. { type: "generating_slide", slideIndex: 2, progress: 40, message: "Synthesizing bullet points..." }
      if (data.type) {
        setEventState({
          type: data.type,
          progress: data.progress ?? 0,
          message: data.message || '',
          slideIndex: data.slideIndex ?? null,
          payload: data.payload || data,
        });

        if (onEvent) onEvent(data.type, data);
      }
    } catch {
      // Non-JSON string message
      setLastMessage({ text: event.data });
    }
  }, [onMessage, onEvent]);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus('connected');
        reconnectCountRef.current = 0;
        console.info(`[useWebSocket] Connected to ${wsUrl}`);
      };

      ws.onmessage = handleSocketMessage;

      ws.onerror = (err) => {
        setStatus('error');
        console.warn('[useWebSocket] Connection error:', err);
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      setStatus('error');
      console.warn('[useWebSocket] Failed to instantiate WebSocket:', err);
    }
  }, [wsUrl, reconnectAttempts, reconnectInterval, handleSocketMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  /**
   * Helper to simulate a realistic real-time generation stream for testing / demo mode
   */
  const simulateGenerationStream = useCallback(async (prompt, onSlideGenerated, onCompleted) => {
    setEventState({ type: 'generating', progress: 10, message: `Analyzing presentation topic: "${prompt}"...` });
    await new Promise((r) => setTimeout(r, 600));

    setEventState({ type: 'generating_slide', progress: 35, slideIndex: 1, message: 'Drafting executive overview...' });
    await new Promise((r) => setTimeout(r, 800));

    setEventState({ type: 'generating_slide', progress: 65, slideIndex: 2, message: 'Structuring system architecture & directives...' });
    await new Promise((r) => setTimeout(r, 900));

    setEventState({ type: 'rendering', progress: 85, message: 'Applying MARP themes and compiling slides...' });
    await new Promise((r) => setTimeout(r, 600));

    const generatedMarkdown = `\n\n---\n\n<!-- _class: lead -->\n# 💡 ${prompt}\n### AI Generated Presentation Slide\n\n- Real-time streamed from Agent WebSocket\n- Instant MARP theme rendering\n- Fully editable in Markdown`;
    
    if (onSlideGenerated) onSlideGenerated(generatedMarkdown);

    setEventState({ type: 'completed', progress: 100, message: 'Slide generated successfully!' });
    if (onCompleted) onCompleted();

    setTimeout(() => {
      setEventState({ type: 'idle', progress: 0, message: '' });
    }, 2500);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    status, // 'disconnected' | 'connecting' | 'connected' | 'error'
    eventState,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    simulateGenerationStream,
  };
}

export default useWebSocket;
