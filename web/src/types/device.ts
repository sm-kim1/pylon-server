export interface DeviceCapabilities {
  ssh: boolean;
  rdp?: boolean;
}

export type DeviceStatus = 'online' | 'offline';

export interface Device {
  id: string;
  name: string;
  ipAddress: string;
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  lastSeen: string;
  connectedAt?: string;
}

export interface DeviceListResponse {
  devices: Device[];
}
