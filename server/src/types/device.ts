// Device type definitions for the device registry

export interface DeviceCapabilities {
  ssh: boolean;
}

export type DeviceStatus = 'online' | 'offline';

export interface DeviceInfo {
  id: string;
  name: string;
  ipAddress: string;
  capabilities: DeviceCapabilities;
}

export interface Device {
  id: string;
  name: string;
  ipAddress: string;
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  lastSeen: Date;
  connectedAt: Date;
}

export interface DeviceListResponse {
  devices: Device[];
}
