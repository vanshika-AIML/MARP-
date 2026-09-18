import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useWebSocket from './useWebSocket';

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances = [];

  constructor() {
    this.readyState = FakeWebSocket.CONNECTING;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe('useWebSocket lifecycle', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.useRealTimers();
  });

  it('reconnects after an unexpected close', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const { result } = renderHook(() => useWebSocket(null, { autoConnect: false, reconnectAttempts: 1, reconnectInterval: 100 }));

    act(() => result.current.connect());
    const socket = FakeWebSocket.instances[0];
    act(() => socket.onclose?.());
    act(() => vi.advanceTimersByTime(100));

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('does not reconnect after manual disconnect or unmount', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const { result, unmount } = renderHook(() => useWebSocket(null, { autoConnect: false, reconnectAttempts: 1, reconnectInterval: 100 }));

    act(() => result.current.connect());
    act(() => result.current.disconnect());
    act(() => vi.advanceTimersByTime(100));
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => result.current.connect());
    unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
