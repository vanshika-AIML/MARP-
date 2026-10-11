import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useWebSocket from './useWebSocket';

class FakeWebSocket {
  static instances = [];
  constructor(url) { this.url = url; FakeWebSocket.instances.push(this); }
  close() { this.onclose?.(); }
}

describe('useWebSocket lifecycle', () => {
  afterEach(() => { FakeWebSocket.instances = []; vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('connects to one resource and deduplicates repeated events', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const onEvent = vi.fn();
    renderHook(() => useWebSocket('/ws/jobs/one', { onEvent }));
    const socket = FakeWebSocket.instances[0];
    act(() => socket.onopen?.());
    const event = JSON.stringify({ event: 'slide.started', updated_at: '2026-01-01', progress: 40 });
    act(() => { socket.onmessage?.({ data: event }); socket.onmessage?.({ data: event }); });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('uses bounded reconnect and cleans up on unmount', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const { unmount } = renderHook(() => useWebSocket('/ws/jobs/one'));
    act(() => FakeWebSocket.instances[0].onclose?.());
    act(() => vi.advanceTimersByTime(1000));
    expect(FakeWebSocket.instances).toHaveLength(2);
    unmount();
    act(() => vi.advanceTimersByTime(20000));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
