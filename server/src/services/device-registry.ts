// Device Registry Service
// Wraps the agentConnections map from websocket/handler.ts

import { agentConnections } from '../websocket/handler.js';
import type { Device, DeviceInfo } from '../types/device.js';

// Stale connection threshold (90 seconds)
const STALE_THRESHOLD_MS = 90 * 1000;

// Cleanup interval (30 seconds)
const CLEANUP_INTERVAL_MS = 30 * 1000;

// Track cleanup interval for shutdown
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Register a new device
 * Note: This is called by the WebSocket handler when an agent registers
 */
export function registerDevice(info: DeviceInfo): void {
  // Device registration is handled by websocket/handler.ts
  // This function exists for API completeness but the actual
  // registration happens through WebSocket agent:register message
  console.log(`[DeviceRegistry] Device registration requested for ${info.id}`);
}

/**
 * Unregister a device
 * Note: This is called by the WebSocket handler when an agent disconnects
 */
export function unregisterDevice(deviceId: string): void {
  // Device unregistration is handled by websocket/handler.ts
  // This function exists for API completeness
  console.log(`[DeviceRegistry] Device unregistration requested for ${deviceId}`);
}

/**
 * Get a single device by ID
 */
export function getDevice(deviceId: string): Device | undefined {
  const connection = agentConnections.get(deviceId);
  if (!connection) {
    return undefined;
  }

  const now = Date.now();
  const isStale = now - connection.lastHeartbeat > STALE_THRESHOLD_MS;

  return {
    id: connection.deviceId,
    name: connection.deviceName,
    ipAddress: connection.ipAddress,
    status: isStale ? 'offline' : 'online',
    capabilities: connection.capabilities,
    lastSeen: new Date(connection.lastHeartbeat),
    connectedAt: new Date(connection.connectedAt),
  };
}

/**
 * Get all devices (both online and offline)
 */
export function getAllDevices(): Device[] {
  const devices: Device[] = [];
  const now = Date.now();

  for (const [, connection] of agentConnections) {
    const isStale = now - connection.lastHeartbeat > STALE_THRESHOLD_MS;
    devices.push({
      id: connection.deviceId,
      name: connection.deviceName,
      ipAddress: connection.ipAddress,
      status: isStale ? 'offline' : 'online',
      capabilities: connection.capabilities,
      lastSeen: new Date(connection.lastHeartbeat),
      connectedAt: new Date(connection.connectedAt),
    });
  }

  return devices;
}

/**
 * Update heartbeat timestamp for a device
 * Note: This is called by the WebSocket handler when a heartbeat is received
 */
export function updateHeartbeat(deviceId: string): void {
  const connection = agentConnections.get(deviceId);
  if (connection) {
    connection.lastHeartbeat = Date.now();
  }
}

/**
 * Get only online devices (not stale)
 */
export function getOnlineDevices(): Device[] {
  const devices: Device[] = [];
  const now = Date.now();

  for (const [, connection] of agentConnections) {
    const isStale = now - connection.lastHeartbeat > STALE_THRESHOLD_MS;
    if (!isStale) {
      devices.push({
        id: connection.deviceId,
        name: connection.deviceName,
        ipAddress: connection.ipAddress,
        status: 'online',
        capabilities: connection.capabilities,
        lastSeen: new Date(connection.lastHeartbeat),
        connectedAt: new Date(connection.connectedAt),
      });
    }
  }

  return devices;
}

/**
 * Clean up stale connections
 * Marks devices as offline if they haven't sent a heartbeat in STALE_THRESHOLD_MS
 * Removes connections that are stale (closes WebSocket)
 */
export function cleanupStaleConnections(): void {
  const now = Date.now();
  const staleDevices: string[] = [];

  for (const [deviceId, connection] of agentConnections) {
    const timeSinceHeartbeat = now - connection.lastHeartbeat;
    if (timeSinceHeartbeat > STALE_THRESHOLD_MS) {
      staleDevices.push(deviceId);
      console.log(
        `[DeviceRegistry] Device ${deviceId} is stale (${Math.round(timeSinceHeartbeat / 1000)}s since last heartbeat)`
      );
      // Close the WebSocket connection
      try {
        connection.socket.close(1000, 'Stale connection');
      } catch {
        // Socket may already be closed
      }
    }
  }

  // Remove stale connections from the map
  for (const deviceId of staleDevices) {
    agentConnections.delete(deviceId);
    console.log(`[DeviceRegistry] Removed stale device ${deviceId}`);
  }

  if (staleDevices.length > 0) {
    console.log(`[DeviceRegistry] Cleaned up ${staleDevices.length} stale connection(s)`);
  }
}

/**
 * Start the cleanup interval
 * Should be called on server start
 */
export function startCleanupInterval(): void {
  if (cleanupIntervalId) {
    console.log('[DeviceRegistry] Cleanup interval already running');
    return;
  }

  cleanupIntervalId = setInterval(() => {
    cleanupStaleConnections();
  }, CLEANUP_INTERVAL_MS);

  console.log(`[DeviceRegistry] Started cleanup interval (every ${CLEANUP_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the cleanup interval
 * Should be called on server shutdown
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[DeviceRegistry] Stopped cleanup interval');
  }
}

/**
 * Get device registry statistics
 */
export function getRegistryStats(): {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
} {
  const all = getAllDevices();
  const online = all.filter((d) => d.status === 'online');

  return {
    totalDevices: all.length,
    onlineDevices: online.length,
    offlineDevices: all.length - online.length,
  };
}
