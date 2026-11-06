import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import crypto from 'crypto';
import { config } from './config/environment.js';
import { authenticateRequest } from './auth/authentication.js';
import { StreamableHttpManager } from './mcp/streamable_http.js';
import { ToolRegistry } from './mcp/tool_registry.js';
import { IntentRouter } from './orchestrator/intent_router.js';
import { adminRoutes } from './admin/routes/admin_routes.js';
import { SlackService } from './integrations/slack_client.js';
import { pool } from './config/db.js';

export async function buildGatewayServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: config.nodeEnv === 'development' ? { level: 'info' } : true,
    genReqId: () => crypto.randomUUID(),
  });

  // Plugins
  await fastify.register(cors, { origin: '*' });
  await fastify.register(sensible);

  // 1. Public Health Endpoint
  fastify.get('/api/health', async (_req, reply) => {
    let dbStatus = 'UNHEALTHY';
    try {
      const res = await pool.query('SELECT 1 as live');
      if (res.rows.length > 0) dbStatus = 'HEALTHY';
    } catch {}

    reply.send({
      status: 'HEALTHY',
      service: 'jarvis-gateway',
      version: '1.0.0',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Register MCP Streamable HTTP Transport (/mcp/stream)
  await StreamableHttpManager.registerRoutes(fastify);

  // 3. Protected APIs Group (Requires Bearer Token)
  fastify.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', authenticateRequest);

    // Intent Router: Unified Conversational Entrypoint
    protectedApp.post('/api/query', async (request, reply) => {
      const body = request.body as { query?: string };
      if (!body || !body.query) {
        reply.status(400).send({ error: 'BAD_REQUEST', message: "Field 'query' is required." });
        return;
      }

      const user = request.userContext!;
      const result = await IntentRouter.routeAndExecute(body.query, user);
      reply.send(result);
    });

    // Tool Discovery Endpoint
    protectedApp.get('/api/tools', async (request, reply) => {
      const user = request.userContext!;
      const tools = ToolRegistry.listTools(user);
      reply.send({ tools });
    });

    // Direct Tool Invocation Endpoint
    protectedApp.post('/api/tools/:name', async (request, reply) => {
      const user = request.userContext!;
      const toolName = (request.params as { name: string }).name;
      const args = request.body || {};

      const result = await ToolRegistry.executeTool(toolName, args, user);
      reply.send(result);
    });

    // Admin Control Plane
    await protectedApp.register(adminRoutes);
  });

  return fastify;
}

// Start Server unless in test mode
const start = async () => {
  try {
    const server = await buildGatewayServer();
    await server.listen({ port: config.port, host: config.host });
    console.log(`🚀 [JARVIS_GATEWAY] Fastify Gateway running on http://${config.host}:${config.port}`);

    // Start Slack Socket Mode client
    await SlackService.initialize();

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down Jarvis Gateway...');
      await SlackService.shutdown();
      await server.close();
      await pool.end();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[GATEWAY_FATAL]', err);
    process.exit(1);
  }
};

if (process.env.TEST_MODE !== 'true') {
  start();
}
