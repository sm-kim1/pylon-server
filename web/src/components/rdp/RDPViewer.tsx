import { useRef, useEffect, useState, useCallback, Component, type ReactNode } from 'react';
import Guacamole from 'guacamole-common-js';
import { useWebSocket } from '../../hooks/useWebSocket';
import { createPylonTunnel } from './PylonTunnel';
import { RDPToolbar } from './RDPToolbar';
import type { Device } from '../../types/device';

const RDP_DEFAULTS = {
  hostname: 'localhost',
  port: '3389',
  security: 'rdp',
  ignoreCert: 'true',
  dpi: '96',
} as const;

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

class RDPErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col w-full h-full bg-black rounded-lg overflow-hidden p-6">
          <p className="text-red-400 font-bold mb-2">RDP Component Crashed</p>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RDPViewerProps {
  device: Device;
  onClose?: () => void;
}

type ConnectionState = 'connecting' | 'session-requested' | 'connected' | 'error' | 'disconnected';

function RDPViewerInner({ device, onClose }: RDPViewerProps) {
  const displayContainerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Guacamole.Client | null>(null);
  const sessionIdRef = useRef<string>('');
  const keyboardRef = useRef<Guacamole.Keyboard | null>(null);
  const mouseRef = useRef<Guacamole.Mouse | null>(null);
  const zObserverRef = useRef<MutationObserver | null>(null);
  const { send, subscribe } = useWebSocket();
  const [state, setState] = useState<ConnectionState>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputEnabled, setInputEnabled] = useState(true);

  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const cleanup = useCallback(() => {
    if (keyboardRef.current) {
      keyboardRef.current.onkeydown = null;
      keyboardRef.current.onkeyup = null;
      keyboardRef.current = null;
    }
    if (mouseRef.current) {
      mouseRef.current.onmousedown = null;
      mouseRef.current.onmouseup = null;
      mouseRef.current.onmousemove = null;
      mouseRef.current = null;
    }
    zObserverRef.current?.disconnect();
    zObserverRef.current = null;
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    }
  }, []);

  const getDisplaySize = useCallback(() => {
    const container = displayContainerRef.current;
    if (!container) return { width: 1024, height: 768 };
    const rect = container.getBoundingClientRect();
    const width = Math.max(2, Math.floor(rect.width / 2) * 2);
    const height = Math.max(2, Math.floor(rect.height / 2) * 2);
    return { width, height };
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    if (inputEnabled) {
      if (!keyboardRef.current) {
        const keyboard = new Guacamole.Keyboard(document);
        keyboard.onkeydown = (keysym: number) => {
          client.sendKeyEvent(1, keysym);
        };
        keyboard.onkeyup = (keysym: number) => {
          client.sendKeyEvent(0, keysym);
        };
        keyboardRef.current = keyboard;
      }

      if (!mouseRef.current && displayRef.current) {
        const mouse = new Guacamole.Mouse(displayRef.current);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState: Guacamole.Mouse.State) => {
          client.sendMouseState(mouseState);
        };
        mouseRef.current = mouse;
      }
    } else {
      if (keyboardRef.current) {
        keyboardRef.current.onkeydown = null;
        keyboardRef.current.onkeyup = null;
        keyboardRef.current = null;
      }
      if (mouseRef.current) {
        mouseRef.current.onmousedown = null;
        mouseRef.current.onmouseup = null;
        mouseRef.current.onmousemove = null;
        mouseRef.current = null;
      }
    }
  }, [inputEnabled]);

  useEffect(() => {
    if (!authenticated) return;

    const sessionId = generateId();
    sessionIdRef.current = sessionId;
    setState('connecting');

    const unsubResponse = subscribe('rdp:session:response', (message: unknown) => {
      const msg = message as { payload?: { sessionId?: string; success?: boolean; error?: string } };
      if (msg.payload?.sessionId !== sessionId) return;

      if (!msg.payload?.success) {
        setState('error');
        setErrorMsg(msg.payload?.error || 'Failed to create RDP session');
        return;
      }

      try {
        const tunnel = createPylonTunnel(sessionId);
        const client = new Guacamole.Client(tunnel);
        clientRef.current = client;

        if (displayRef.current) {
          const display = client.getDisplay();
          const element = display.getElement();
          displayRef.current.innerHTML = '';
          displayRef.current.appendChild(element);

          // Guacamole sets z-index:-1 on the default layer canvas, which
          // renders it behind the opaque container background.  Fix every
          // canvas that appears inside the display element.
          const fixCanvasZIndex = () => {
            displayRef.current?.querySelectorAll('canvas').forEach((c) => {
              if (c.style.zIndex === '-1') {
                c.style.zIndex = '0';
              }
            });
          };
          fixCanvasZIndex();

          const observer = new MutationObserver(fixCanvasZIndex);
          observer.observe(displayRef.current, { childList: true, subtree: true });

          zObserverRef.current = observer;
        }

        client.onstatechange = (clientState: number) => {
          switch (clientState) {
            case 3:
              setState('connected');
              break;
            case 5:
              setState('disconnected');
              break;
          }
        };

        client.onerror = (error: Guacamole.Status) => {
          setState('error');
          setErrorMsg(error.message || `Guacamole error (code ${error.code})`);
        };

        // Set up keyboard
        if (inputEnabled) {
          const keyboard = new Guacamole.Keyboard(document);
          keyboard.onkeydown = (keysym: number) => {
            client.sendKeyEvent(1, keysym);
          };
          keyboard.onkeyup = (keysym: number) => {
            client.sendKeyEvent(0, keysym);
          };
          keyboardRef.current = keyboard;
        }

        // Set up mouse
        if (inputEnabled && displayRef.current) {
          const mouse = new Guacamole.Mouse(displayRef.current);
          mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState: Guacamole.Mouse.State) => {
            client.sendMouseState(mouseState);
          };
          mouseRef.current = mouse;
        }

        const { width, height } = getDisplaySize();
        const params = new URLSearchParams({
          hostname: RDP_DEFAULTS.hostname,
          port: RDP_DEFAULTS.port,
          username,
          password,
          security: RDP_DEFAULTS.security,
          'ignore-cert': RDP_DEFAULTS.ignoreCert,
          width: String(width),
          height: String(height),
          dpi: RDP_DEFAULTS.dpi,
          'resize-method': 'display-update',
        });

        client.connect(params.toString());
      } catch (err) {
        setState('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize Guacamole client');
      }
    });

    send('rdp:session:request', { deviceId: device.id, sessionId });
    setState('session-requested');

    return () => {
      unsubResponse();
      cleanup();
      if (sessionIdRef.current) {
        send('rdp:close', { sessionId: sessionIdRef.current, reason: 'Component unmounted' });
      }
    };
  }, [authenticated, device.id, send, subscribe, cleanup, getDisplaySize, username, password, inputEnabled]);

  // Dynamic resolution via Display Update Virtual Channel (MS-RDPEDISP).
  // When resize-method=display-update is set, guacd uses FreeRDP's
  // SupportDisplayControl to send DISPLAY_CONTROL_MONITOR_LAYOUT PDUs
  // to xrdp, which resizes via xorgxrdp+xrandr — no reconnect needed.
  useEffect(() => {
    const container = displayContainerRef.current;
    const client = clientRef.current;
    if (!container || !client || state !== 'connected') return;

    let debounceTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const { width, height } = getDisplaySize();
        client.sendSize(width, height);
      }, 150);
    });

    observer.observe(container);
    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [state, getDisplaySize]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleToggleInput = useCallback(() => {
    setInputEnabled((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    cleanup();
    onClose?.();
  }, [cleanup, onClose]);

  const handleAuthSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setAuthenticated(true);
  }, [username]);

  const isConnected = state === 'connected';

  const containerClasses = `flex flex-col bg-black overflow-hidden border border-gray-800 ${
    isFullscreen ? 'fixed inset-0 z-[60] rounded-none border-0' : 'h-full rounded-lg'
  }`;

  if (!authenticated) {
    return (
      <div className={containerClasses}>
        <RDPToolbar
          deviceName={device.name}
          isConnected={false}
          isFullscreen={isFullscreen}
          inputEnabled={inputEnabled}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleInput={handleToggleInput}
          onClose={handleClose}
        />

        <div className="flex-1 min-h-0 flex items-center justify-center bg-[#0a0a0a]">
          <form onSubmit={handleAuthSubmit} className="flex flex-col items-center gap-4 w-80">
            <div className="w-12 h-12 rounded-full bg-orange-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-white text-lg font-medium">Remote Desktop</h3>
            <p className="text-gray-400 text-sm text-center">
              Enter credentials to access {device.name}
            </p>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />

            <button
              type="submit"
              disabled={!username.trim()}
              className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <RDPToolbar
        deviceName={device.name}
        isConnected={isConnected}
        isFullscreen={isFullscreen}
        inputEnabled={inputEnabled}
        onToggleFullscreen={handleToggleFullscreen}
        onToggleInput={handleToggleInput}
        onClose={handleClose}
      />

      {state === 'error' && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      <div ref={displayContainerRef} className="flex-1 min-h-0 relative bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        {(state === 'connecting' || state === 'session-requested') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-sm">Connecting to {device.name}...</span>
            </div>
          </div>
        )}

        {state === 'disconnected' && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-gray-400">Disconnected</span>
            <button
              onClick={() => {
                setAuthenticated(false);
                setState('connecting');
              }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              Reconnect
            </button>
          </div>
        )}

        <div
          ref={displayRef}
          className="max-w-full max-h-full"
          style={{
            cursor: isConnected && inputEnabled ? 'none' : 'default',
            display: isConnected || state === 'session-requested' || state === 'connecting' ? 'block' : 'none',
          }}
        />
      </div>
    </div>
  );
}

export function RDPViewer(props: RDPViewerProps) {
  return (
    <RDPErrorBoundary>
      <RDPViewerInner {...props} />
    </RDPErrorBoundary>
  );
}
