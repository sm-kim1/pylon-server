import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { generateId } from '../utils/uuid';
import type { TerminalHandle } from '../components/terminal/Terminal';

interface SSHSessionState {
  sessionId: string | null;
  deviceId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

interface UseSSHSessionOptions {
  deviceId: string;
  terminalRef: React.RefObject<TerminalHandle>;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

export function useSSHSession({
  deviceId,
  terminalRef,
  onConnect,
  onDisconnect,
  onError,
}: UseSSHSessionOptions) {
  const { isConnected: wsConnected, send, subscribe } = useWebSocket();
  const [state, setState] = useState<SSHSessionState>({
    sessionId: null,
    deviceId,
    status: 'disconnected',
    error: null,
  });
  
  const sessionIdRef = useRef<string | null>(null);

  // Handle SSH session response
  useEffect(() => {
    const unsubResponse = subscribe('ssh:session:response', (message: unknown) => {
      const msg = message as { payload?: { sessionId: string; success: boolean; error?: string } };
      if (msg.payload?.sessionId === sessionIdRef.current) {
        if (msg.payload.success) {
          setState(prev => ({ ...prev, status: 'connected', error: null }));
          onConnect?.();
        } else {
          const errorMsg = msg.payload.error || 'Failed to connect';
          setState(prev => ({ ...prev, status: 'error', error: errorMsg }));
          onError?.(errorMsg);
        }
      }
    });

    // Handle SSH data from server
    const unsubData = subscribe('ssh:data', (message: unknown) => {
      const msg = message as { payload?: { sessionId: string; data: string } };
      if (msg.payload?.sessionId === sessionIdRef.current && msg.payload.data) {
        // Decode base64 to raw bytes, then decode as UTF-8
        const binaryString = atob(msg.payload.data);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        terminalRef.current?.write(decoded);
      }
    });

    // Handle SSH close
    const unsubClose = subscribe('ssh:close', (message: unknown) => {
      const msg = message as { payload?: { sessionId: string; reason?: string } };
      if (msg.payload?.sessionId === sessionIdRef.current) {
        setState(prev => ({ ...prev, status: 'disconnected', sessionId: null }));
        sessionIdRef.current = null;
        onDisconnect?.();
        terminalRef.current?.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
      }
    });

    return () => {
      unsubResponse();
      unsubData();
      unsubClose();
    };
  }, [subscribe, terminalRef, onConnect, onDisconnect, onError]);

  // Connect to SSH session
  const connect = useCallback(() => {
    if (!wsConnected) {
      setState(prev => ({ ...prev, status: 'error', error: 'WebSocket not connected' }));
      return;
    }

    const sessionId = generateId();
    sessionIdRef.current = sessionId;
    
    setState(prev => ({ ...prev, sessionId, status: 'connecting', error: null }));

    send('ssh:session:request', { deviceId, sessionId });
  }, [wsConnected, deviceId, send]);

  // Disconnect SSH session
  const disconnect = useCallback(() => {
    if (sessionIdRef.current) {
      send('ssh:close', { sessionId: sessionIdRef.current });
      setState(prev => ({ ...prev, status: 'disconnected', sessionId: null }));
      sessionIdRef.current = null;
    }
  }, [send]);

  // Send terminal data
  const sendData = useCallback((data: string) => {
    if (sessionIdRef.current && state.status === 'connected') {
      // Encode UTF-8 string to base64
      const bytes = new TextEncoder().encode(data);
      const binaryString = Array.from(bytes, b => String.fromCharCode(b)).join('');
      const encoded = btoa(binaryString);
      send('ssh:data', { sessionId: sessionIdRef.current, data: encoded });
    }
  }, [state.status, send]);

  // Send terminal resize
  const sendResize = useCallback((cols: number, rows: number) => {
    if (sessionIdRef.current && state.status === 'connected') {
      send('ssh:resize', { sessionId: sessionIdRef.current, cols, rows });
    }
  }, [state.status, send]);

  return {
    ...state,
    wsConnected,
    connect,
    disconnect,
    sendData,
    sendResize,
  };
}
