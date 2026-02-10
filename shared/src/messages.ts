// WebSocket message types for communication between components

// Base message structure
export interface BaseMessage {
  type: string;
  timestamp: number;
}

// ==================== Agent ↔ Server Messages ====================

// Agent registration
export interface AgentRegisterMessage extends BaseMessage {
  type: 'agent:register';
  payload: {
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    capabilities: {
      ssh: boolean;
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

// Agent heartbeat
export interface AgentHeartbeatMessage extends BaseMessage {
  type: 'agent:heartbeat';
  payload: {
    deviceId: string;
  };
}

export interface AgentHeartbeatAckMessage extends BaseMessage {
  type: 'agent:heartbeat:ack';
}

// ==================== Browser ↔ Server Messages ====================

// Device list request/response
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

// ==================== SSH Session Messages ====================

// SSH session request (Browser → Server → Agent)
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

// SSH data (bidirectional)
export interface SSHDataMessage extends BaseMessage {
  type: 'ssh:data';
  payload: {
    sessionId: string;
    data: string; // base64 encoded
  };
}

// SSH resize
export interface SSHResizeMessage extends BaseMessage {
  type: 'ssh:resize';
  payload: {
    sessionId: string;
    cols: number;
    rows: number;
  };
}

// SSH session close
export interface SSHCloseMessage extends BaseMessage {
  type: 'ssh:close';
  payload: {
    sessionId: string;
    reason?: string;
  };
}

// ==================== RDP Session Messages ====================

// RDP session request (Browser → Server → Agent)
export interface RDPSessionRequestMessage extends BaseMessage {
  type: 'rdp:session:request';
  payload: {
    deviceId: string;
    sessionId: string;
  };
}

export interface RDPSessionResponseMessage extends BaseMessage {
  type: 'rdp:session:response';
  payload: {
    sessionId: string;
    success: boolean;
    error?: string;
  };
}

// RDP data (bidirectional - Guacamole protocol data)
export interface RDPDataMessage extends BaseMessage {
  type: 'rdp:data';
  payload: {
    sessionId: string;
    data: string;
  };
}

// RDP session close
export interface RDPCloseMessage extends BaseMessage {
  type: 'rdp:close';
  payload: {
    sessionId: string;
    reason?: string;
  };
}

// ==================== Error Messages ====================

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ==================== Union Types ====================

export type AgentMessage =
  | AgentRegisterMessage
  | AgentHeartbeatMessage
  | SSHDataMessage
  | SSHCloseMessage
  | RDPSessionResponseMessage
  | RDPDataMessage
  | RDPCloseMessage;

export type ServerToAgentMessage =
  | AgentRegisterAckMessage
  | AgentHeartbeatAckMessage
  | SSHSessionRequestMessage
  | SSHDataMessage
  | SSHResizeMessage
  | SSHCloseMessage
  | RDPSessionRequestMessage
  | RDPDataMessage
  | RDPCloseMessage;

export type BrowserMessage =
  | DeviceListRequestMessage
  | SSHSessionRequestMessage
  | SSHDataMessage
  | SSHResizeMessage
  | SSHCloseMessage
  | RDPSessionRequestMessage
  | RDPDataMessage
  | RDPCloseMessage;

export type ServerToBrowserMessage =
  | DeviceListResponseMessage
  | SSHSessionResponseMessage
  | SSHDataMessage
  | SSHCloseMessage
  | RDPSessionResponseMessage
  | RDPDataMessage
  | RDPCloseMessage
  | ErrorMessage;

// Helper to create messages
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
