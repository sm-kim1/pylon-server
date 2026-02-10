type MessageHandler = (message: unknown) => void;

interface WebSocketClientOptions {
  url: string;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: MessageHandler;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private isConnecting = false;

  constructor(options: WebSocketClientOptions) {
    this.options = {
      onOpen: () => {},
      onClose: () => {},
      onError: () => {},
      onMessage: () => {},
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.options.onOpen();
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.options.onClose(event);
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      this.options.onError(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.options.onMessage(message);
        
        // Dispatch to type-specific handlers
        if (message.type && this.messageHandlers.has(message.type)) {
          this.messageHandlers.get(message.type)?.forEach(handler => handler(message));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  disconnect(): void {
    this.options.reconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  send(type: string, payload?: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    const message = {
      type,
      timestamp: Date.now(),
      ...(payload !== undefined && { payload }),
    };

    this.ws.send(JSON.stringify(message));
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: MessageHandler): void {
    this.messageHandlers.get(type)?.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  private handleReconnect(): void {
    if (!this.options.reconnect || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }
}

// Singleton instance for browser WebSocket
let browserClient: WebSocketClient | null = null;

export function getBrowserWebSocket(): WebSocketClient {
  if (!browserClient) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
    // Use relative path /ws to leverage Vite proxy in development
    // In production or when VITE_WS_URL is set, use the specified URL
    const baseUrl = envUrl && envUrl.length > 0
      ? envUrl
      : `${protocol}//${window.location.host}/ws`;
    const url = baseUrl.includes('type=browser')
      ? baseUrl
      : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}type=browser`;
    
    browserClient = new WebSocketClient({
      url,
      onOpen: () => console.log('WebSocket connected'),
      onClose: () => console.log('WebSocket disconnected'),
      onError: (error) => console.error('WebSocket error:', error),
    });
  }
  return browserClient;
}
