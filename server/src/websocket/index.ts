// WebSocket route registration

import type { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { ConnectionType } from '../types/messages.js';
import { handleConnection, getConnectionStats } from './handler.js';

/**
 * Register WebSocket routes
 */
export async function registerWebSocketRoutes(fastify: FastifyInstance): Promise<void> {
  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (socket: SocketStream, request) => {
    const query = request.query as Record<string, string>;
    const connectionType = query.type as ConnectionType | undefined;

    // Validate connection type
    if (!connectionType || (connectionType !== 'agent' && connectionType !== 'browser')) {
      fastify.log.warn({ type: connectionType }, 'Invalid connection type, defaulting to browser');
      handleConnection(socket.socket, 'browser', fastify.log);
      return;
    }

    handleConnection(socket.socket, connectionType, fastify.log);
  });

  // Stats endpoint for debugging/monitoring
  fastify.get('/ws/stats', async () => {
    return getConnectionStats();
  });

  fastify.log.info('WebSocket routes registered');
}
