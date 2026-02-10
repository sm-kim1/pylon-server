import { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.js';
import { registerApiRoutes } from './api.js';

export async function registerRoutes(fastify: FastifyInstance) {
  await registerHealthRoutes(fastify);
  await registerApiRoutes(fastify);
}
