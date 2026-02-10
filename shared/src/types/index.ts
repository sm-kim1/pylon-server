// Device types
export interface Device {
  id: string;
  name: string;
  ipAddress: string;
  status: DeviceStatus;
  lastSeen: Date;
  capabilities: DeviceCapabilities;
}

export type DeviceStatus = 'online' | 'offline' | 'connecting';

export interface DeviceCapabilities {
  ssh: boolean;
}

// Session types
export interface Session {
  id: string;
  deviceId: string;
  type: SessionType;
  status: SessionStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export type SessionType = 'ssh' | 'rdp';
export type SessionStatus = 'connecting' | 'active' | 'disconnected' | 'error';

// Connection types
export interface ConnectionInfo {
  deviceId: string;
  sessionId: string;
  type: SessionType;
}
