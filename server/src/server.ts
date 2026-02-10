import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import config from './config.js';
import { registerRoutes } from './routes/index.js';
import { registerWebSocketRoutes } from './websocket/index.js';
import { startCleanupInterval, stopCleanupInterval } from './services/device-registry.js';

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
  });

  // Register WebSocket plugin
  await fastify.register(websocket);

  // Register HTTP routes
  await registerRoutes(fastify);

  // Register WebSocket routes
  await registerWebSocketRoutes(fastify);

  return fastify;
}

export async function startServer(fastify: Awaited<ReturnType<typeof createServer>>) {
  try {
    await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${config.PORT}`);

    // Start device registry cleanup interval
    startCleanupInterval();

    // Handle graceful shutdown
    const shutdown = async () => {
      fastify.log.info('Shutting down server...');
      stopCleanupInterval();
      await fastify.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
