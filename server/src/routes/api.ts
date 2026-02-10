// API routes for REST endpoints

import { FastifyInstance } from 'fastify';
import { getOnlineDevices, getRegistryStats } from '../services/device-registry.js';
import type { DeviceListResponse } from '../types/device.js';

export async function registerApiRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/devices
   * Returns list of online devices
   */
  fastify.get<{
    Reply: DeviceListResponse;
  }>('/api/devices', async (_request, _reply) => {
    const devices = getOnlineDevices();
    return { devices };
  });

  /**
   * GET /api/devices/stats
   * Returns device registry statistics
   */
  fastify.get('/api/devices/stats', async (_request, _reply) => {
    return getRegistryStats();
  });
}
