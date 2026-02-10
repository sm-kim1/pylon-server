import type { WebSocket } from 'ws';

export interface SSHSession {
  id: string;
  deviceId: string;
  browserSocket: WebSocket;
  agentSocket: WebSocket;
  status: 'connecting' | 'active' | 'closed';
  createdAt: Date;
  terminalSize: {
    cols: number;
    rows: number;
  };
}

export interface RDPSession {
  id: string;
  deviceId: string;
  browserSocket: WebSocket;
  agentSocket: WebSocket;
  status: 'connecting' | 'active' | 'closed';
  createdAt: Date;
}
