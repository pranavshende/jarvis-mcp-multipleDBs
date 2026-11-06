import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolRegistry } from './tool_registry.js';
import { IdentityResolver } from '../auth/identity_resolver.js';
import { UserContext } from '../security/request_context.js';

interface SessionData {
  user: UserContext;
  server: Server;
  transport: StreamableHTTPServerTransport;
  lastActive: number;
}

export class StreamableHttpManager {
  private static sessions: Map<string, SessionData> = new Map();
  private static keepaliveTimer: NodeJS.Timeout | null = null;

  public static initializeKeepalive() {
    if (this.keepaliveTimer) return;
    this.keepaliveTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.lastActive > 30 * 60 * 1000) {
          // Session expired after 30 min of inactivity
          session.transport.close().catch(() => {});
          this.sessions.delete(id);
        }
      }
    }, 15000); // 15-second check
  }

  public static createServerForUser(user: UserContext): { server: Server; transport: StreamableHTTPServerTransport } {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `mcp_sess_${crypto.randomUUID()}`,
    });

    const server = new Server(
      {
        name: 'jarvis-gateway-streamable',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // List tools for user
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const registered = ToolRegistry.listTools(user);
      const tools = registered.map((t) => {
        let jsonSchema: any;
        try {
          jsonSchema = (zodToJsonSchema as any)(t.inputSchema);
          delete jsonSchema.$schema;
        } catch {
          jsonSchema = { type: 'object', properties: {} };
        }
        return {
          name: t.name,
          description: t.description,
          inputSchema: jsonSchema,
        };
      });
      return { tools };
    });

    // Execute tool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await ToolRegistry.executeTool(name, args || {}, user);
        return result;
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, err.message);
      }
    });

    return { server, transport };
  }

  public static async registerRoutes(fastify: FastifyInstance) {
    this.initializeKeepalive();

    // Universal Streamable HTTP Endpoint at /mcp/stream
    fastify.all('/mcp/stream', async (request: FastifyRequest, reply: FastifyReply) => {
      // 1. Resolve Bearer Token
      const authHeader = request.headers.authorization;
      const queryToken = (request.query as any)?.token;
      let rawToken = '';

      if (authHeader && authHeader.startsWith('Bearer ')) {
        rawToken = authHeader.substring(7).trim();
      } else if (queryToken) {
        rawToken = String(queryToken).trim();
      }

      if (!rawToken) {
        reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Bearer token required for Streamable HTTP MCP connection.',
        });
        return;
      }

      const userContext = await IdentityResolver.resolveFromToken(rawToken, 'MCP_STREAM');
      if (!userContext) {
        reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Invalid, expired, or revoked token.',
        });
        return;
      }

      // Check existing session or create stateful transport
      const sessionIdHeader = request.headers['mcp-session-id'] as string;
      let session = sessionIdHeader ? this.sessions.get(sessionIdHeader) : undefined;

      if (!session) {
        const { server, transport } = this.createServerForUser(userContext);
        await server.connect(transport);
        const sId = transport.sessionId || `mcp_sess_${crypto.randomUUID()}`;
        session = {
          user: userContext,
          server,
          transport,
          lastActive: Date.now(),
        };
        this.sessions.set(sId, session);
      }

      // Security: verify session owner
      if (session.user.userId !== userContext.userId) {
        reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Cannot access another user\'s MCP session.',
        });
        return;
      }

      session.lastActive = Date.now();

      // Delegate request handling to the official StreamableHTTPServerTransport
      try {
        await session.transport.handleRequest(request.raw, reply.raw, request.body);
        reply.hijack();
      } catch (err: any) {
        reply.status(500).send({ error: 'STREAM_ERROR', message: err.message });
      }
    });
  }
}
