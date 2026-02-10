import type { DeviceListResponse } from '../types/device';

const API_BASE = '/api';

export async function fetchDevices(): Promise<DeviceListResponse> {
  const response = await fetch(`${API_BASE}/devices`);
  if (!response.ok) {
    throw new Error(`Failed to fetch devices: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchDeviceStats(): Promise<{
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
}> {
  const response = await fetch(`${API_BASE}/devices/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch device stats: ${response.statusText}`);
  }
  return response.json();
}
