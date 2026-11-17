'use client';

// LiveAudioMonitor — compact WebSocket status panel for the dashboard.
// Connects to the standalone live-audio-server.mjs on :8090 and shows
// connection state + rolling message count. Why: the voice/live-audio
// subsystem was running but invisible from the dashboard — operators had
// no way to know whether the WS bridge was healthy without opening a
// terminal. This gives at-a-glance status with a reconnect button.

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_LIVE_AUDIO_WS_URL || 'ws://localhost:8090';
// The live-audio bridge runs on the operator's own machine (:8090). From a
// public origin, ws://localhost can never reach it - attempting (and
// auto-reconnecting forever) only floods every visitor's console. Only
// auto-connect on localhost unless an explicit public WS URL is configured.
const MAX_AUTO_RECONNECTS = 3;

function canAutoConnect(): boolean {
  if (process.env.NEXT_PUBLIC_LIVE_AUDIO_WS_URL) return true;
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

export default function LiveAudioMonitor() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'local-only'>(
    () => (canAutoConnect() ? 'connecting' : 'local-only'),
  );
  const [messageCount, setMessageCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref indirection for the reconnect timer: onclose must schedule the *latest* connect without the useCallback closing over itself (react-hooks/immutability).
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    // Close any existing socket before reconnecting to avoid leaks
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('connecting');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        setMessageCount((c) => c + 1);
        // Keep only a short preview of the last payload
        const raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        setLastMessage(raw.slice(0, 80));
      };

      ws.onclose = () => {
        setStatus('disconnected');
        // Auto-reconnect a few times (server may restart), then stop -
        // the manual Reconnect button re-arms. No infinite console spam.
        attemptsRef.current += 1;
        if (attemptsRef.current <= MAX_AUTO_RECONNECTS) {
          reconnectTimer.current = setTimeout(() => connectRef.current?.(), 10_000);
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so just mark state
        setStatus('disconnected');
      };
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    if (!canAutoConnect()) return;
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const statusColor =
    status === 'connected'
      ? 'text-green-500'
      : status === 'connecting'
        ? 'text-yellow-500'
        : status === 'local-only'
          ? 'text-muted-foreground'
          : 'text-red-500';

  const statusDot =
    status === 'connected'
      ? 'bg-green-500'
      : status === 'connecting'
        ? 'bg-yellow-500 animate-pulse'
        : status === 'local-only'
          ? 'bg-muted-foreground'
          : 'bg-red-500';

  return (
    <div className="bg-background border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={'w-2 h-2 rounded-full ' + statusDot} />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Live Audio WS
          </span>
        </div>
        <button type="button"
          onClick={connect}
          className="text-xs text-secondary hover:underline font-medium"
          aria-label="Reconnect to live audio WebSocket"
        >
          Reconnect
        </button>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={'text-sm font-bold ' + statusColor}>
          {status === 'connected'
            ? 'Connected'
            : status === 'connecting'
              ? 'Connecting...'
              : status === 'local-only'
                ? 'Local only'
                : 'Disconnected'}
        </span>
        <span className="text-xs text-muted-foreground">
          {messageCount > 0
            ? messageCount + ' msgs'
            : status === 'local-only'
              ? 'runs on the operator machine (:8090)'
              : 'port 8090'}
        </span>
      </div>

      {lastMessage && (
        <p className="text-xs text-muted-foreground font-mono truncate" title={lastMessage}>
          {lastMessage}
        </p>
      )}
    </div>
  );
}
