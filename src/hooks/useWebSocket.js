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
  const manualCloseRef = useRef(false);
  const socketIdRef = useRef(0);

  const wsUrl = `${(customUrl || DEFAULT_WS_URL).replace(/\/$/, '')}/ws/generation`;

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
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    manualCloseRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      const socketId = ++socketIdRef.current;

      ws.onopen = () => {
        if (socketId !== socketIdRef.current) return;
        setStatus('connected');
        reconnectCountRef.current = 0;
        console.info(`[useWebSocket] Connected to ${wsUrl}`);
      };

      ws.onmessage = handleSocketMessage;

      ws.onerror = (err) => {
        if (socketId !== socketIdRef.current) return;
        setStatus('error');
        console.warn('[useWebSocket] Connection error:', err);
      };

      ws.onclose = () => {
        if (socketId !== socketIdRef.current) return;
        setStatus('disconnected');
        wsRef.current = null;
        if (!manualCloseRef.current && reconnectCountRef.current < reconnectAttempts) {
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
    manualCloseRef.current = true;
    socketIdRef.current += 1;
    reconnectCountRef.current = 0;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  /**
   * Helper to simulate a realistic real-time generation stream for testing / demo mode
   */
  const simulateGenerationStream = useCallback(async (prompt, onSlideGenerated, onCompleted, generationType = 'slide') => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    setEventState({ type: 'generating', progress: 10, message: `Analyzing topic: "${prompt}"...` });
    await wait(500);

    if (generationType === 'deck') {
      setEventState({ type: 'outlining', progress: 25, message: 'Creating a coherent slide outline...' });
      await wait(550);
      const sections = ['The opportunity', 'Key ideas', 'How it works', 'Expected impact'];
      const slides = sections.map((section, index) => {
        setEventState({ type: 'generating_slide', progress: 35 + index * 10, slideIndex: index + 2, message: `Generating slide ${index + 2} of ${sections.length + 1}: ${section}` });
        return `\n\n---\n\n## ${section}\n\n- ${prompt} becomes actionable through a clear, repeatable workflow\n- Focused decisions replace fragmented manual effort\n- The next step is measurable, collaborative, and ready to ship`;
      });
      await wait(900);
      setEventState({ type: 'styling', progress: 82, message: 'Applying theme and presentation hierarchy...' });
      await wait(450);
      const generatedMarkdown = `---\nmarp: true\ntheme: executive\npaginate: true\nheader: "MARP Studio AI Agent"\nfooter: "Generated presentation"\n---\n\n<!-- _class: lead -->\n# ${prompt}\n\n### A clear story, ready to present\n${slides.join('')}`;
      if (onSlideGenerated) onSlideGenerated(generatedMarkdown);
    } else {
      setEventState({ type: 'generating_slide', progress: 55, slideIndex: 1, message: 'Drafting a focused visual slide...' });
      await wait(800);
      setEventState({ type: 'styling', progress: 82, message: 'Applying hierarchy and theme...' });
      await wait(400);
      const generatedMarkdown = `\n\n---\n\n<!-- _class: lead -->\n# ${prompt}\n\n- A focused, presentation-ready point of view\n- Clear hierarchy for fast audience comprehension\n- Fully editable MARP Markdown`;
      if (onSlideGenerated) onSlideGenerated(generatedMarkdown);
    }

    setEventState({ type: 'rendering', progress: 94, message: 'Rendering presentation canvas...' });
    await wait(350);
    setEventState({ type: 'completed', progress: 100, message: generationType === 'deck' ? 'Full deck generated successfully!' : 'Slide generated successfully!' });
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
