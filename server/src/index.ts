import { createServer, startServer } from './server.js';

async function main() {
  const fastify = await createServer();
  await startServer(fastify);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
