import { FastifyRequest, FastifyReply } from 'fastify';
import { IdentityResolver } from './identity_resolver.js';

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header. Expected Bearer token.',
      latencyMs: Math.round((performance.now() - startTime) * 100) / 100,
    });
    return;
  }

  const rawToken = authHeader.substring(7).trim();
  const clientTypeHeader = (request.headers['x-jarvis-client'] as string) || 'API';
  const clientType = ['SLACK', 'MCP_STREAM', 'MCP_STDIO', 'ADMIN_UI', 'API'].includes(clientTypeHeader)
    ? (clientTypeHeader as any)
    : 'API';

  const userContext = await IdentityResolver.resolveFromToken(
    rawToken,
    clientType,
    (request.headers['x-request-id'] as string) || undefined
  );

  const authDuration = Math.round((performance.now() - startTime) * 100) / 100;

  if (!userContext) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid, expired, or revoked Jarvis Bearer token.',
      latencyMs: authDuration,
    });
    return;
  }

  request.userContext = userContext;
}
