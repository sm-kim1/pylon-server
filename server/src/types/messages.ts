import type { WebSocket } from 'ws';

export interface BaseMessage {
  type: string;
  timestamp: number;
}

export interface AgentRegisterMessage extends BaseMessage {
  type: 'agent:register';
  payload: {
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    capabilities: {
      ssh: boolean;
      rdp?: boolean;
    };
  };
}

export interface AgentRegisterAckMessage extends BaseMessage {
  type: 'agent:register:ack';
  payload: {
    success: boolean;
    deviceId: string;
    error?: string;
  };
}

export interface AgentHeartbeatMessage extends BaseMessage {
  type: 'agent:heartbeat';
  payload: {
    deviceId: string;
  };
}

export interface AgentHeartbeatAckMessage extends BaseMessage {
  type: 'agent:heartbeat:ack';
}

export interface DeviceListRequestMessage extends BaseMessage {
  type: 'devices:list:request';
}

export interface DeviceListResponseMessage extends BaseMessage {
  type: 'devices:list:response';
  payload: {
    devices: Array<{
      id: string;
      name: string;
      ipAddress: string;
      status: 'online' | 'offline';
      capabilities: {
        ssh: boolean;
        rdp?: boolean;
      };
    }>;
  };
}

export interface SSHSessionRequestMessage extends BaseMessage {
  type: 'ssh:session:request';
  payload: {
    deviceId: string;
    sessionId: string;
  };
}

export interface SSHSessionResponseMessage extends BaseMessage {
  type: 'ssh:session:response';
  payload: {
    sessionId: string;
    success: boolean;
    error?: string;
  };
}

export interface SSHDataMessage extends BaseMessage {
  type: 'ssh:data';
  payload: {
    sessionId: string;
    data: string;
  };
}

export interface SSHResizeMessage extends BaseMessage {
  type: 'ssh:resize';
  payload: {
    sessionId: string;
    cols: number;
    rows: number;
  };
}

export interface SSHCloseMessage extends BaseMessage {
  type: 'ssh:close';
  payload: {
    sessionId: string;
    reason?: string;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type AgentMessage =
  | AgentRegisterMessage
  | AgentHeartbeatMessage
  | SSHSessionResponseMessage
  | SSHDataMessage
  | SSHCloseMessage;

export type ServerToAgentMessage =
  | AgentRegisterAckMessage
  | AgentHeartbeatAckMessage
  | SSHSessionRequestMessage
  | SSHDataMessage
  | SSHResizeMessage
  | SSHCloseMessage;

export type BrowserMessage =
  | DeviceListRequestMessage
  | SSHSessionRequestMessage
  | SSHDataMessage
  | SSHResizeMessage
  | SSHCloseMessage;

export type ServerToBrowserMessage =
  | DeviceListResponseMessage
  | SSHSessionResponseMessage
  | SSHDataMessage
  | SSHCloseMessage
  | ErrorMessage;

export function createMessage<T extends BaseMessage>(
  type: T['type'],
  payload?: T extends { payload: infer P } ? P : never
): T {
  return {
    type,
    timestamp: Date.now(),
    ...(payload !== undefined && { payload }),
  } as T;
}

export type ConnectionType = 'agent' | 'browser';

export interface AgentConnectionInfo {
  socket: WebSocket;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  capabilities: {
    ssh: boolean;
    rdp?: boolean;
  };
  connectedAt: number;
  lastHeartbeat: number;
}

export interface BrowserConnectionInfo {
  id: string;
  socket: WebSocket;
  connectedAt: number;
}

export type HandledMessageType =
  | 'agent:register'
  | 'agent:heartbeat'
  | 'devices:list:request'
  | 'ssh:session:request'
  | 'ssh:session:response'
  | 'ssh:data'
  | 'ssh:resize'
  | 'ssh:close'
  | 'rdp:session:request'
  | 'rdp:session:response'
  | 'rdp:data'
  | 'rdp:close'
  | 'error';

export interface ParsedMessage {
  type: string;
  timestamp: number;
  payload?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: ParsedMessage;
}
