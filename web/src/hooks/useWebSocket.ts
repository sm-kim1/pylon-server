import { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketClient, getBrowserWebSocket } from '../services/websocket';

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const client = getBrowserWebSocket();
    clientRef.current = client;

    // Track connection state changes
    const checkConnection = () => setIsConnected(client.isConnected);
    
    // Poll connection state (simple approach for singleton)
    const interval = setInterval(checkConnection, 1000);
    
    if (autoConnect && !client.isConnected) {
      client.connect();
    }

    // Check initial state
    setIsConnected(client.isConnected);

    return () => {
      clearInterval(interval);
    };
  }, [autoConnect]);

  const send = useCallback((type: string, payload?: unknown) => {
    clientRef.current?.send(type, payload);
  }, []);

  const subscribe = useCallback((type: string, handler: (message: unknown) => void) => {
    return clientRef.current?.on(type, handler) ?? (() => {});
  }, []);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    isConnected,
    send,
    subscribe,
    connect,
    disconnect,
    client: clientRef.current,
  };
}
