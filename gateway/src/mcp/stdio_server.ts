#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
import { config } from '../config/environment.js';

// IMPORTANT: Never write diagnostic logs to stdout. All logs go to stderr!
function logStderr(msg: string) {
  process.stderr.write(`[JARVIS_MCP_STDIO] ${new Date().toISOString()} ${msg}\n`);
}

async function startStdioServer() {
  logStderr('Initializing Jarvis MCP stdio server...');

  // Resolve user identity from environment variable JARVIS_BEARER_TOKEN or default local founder
  const rawToken = process.env.JARVIS_BEARER_TOKEN || 'msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c';
  let userContext: UserContext | null = null;

  try {
    userContext = await IdentityResolver.resolveFromToken(rawToken, 'MCP_STDIO');
  } catch (err: any) {
    logStderr(`Failed to resolve token from database: ${err.message}. Falling back to local founder context.`);
  }

  if (!userContext) {
    userContext = {
      userId: 'LOCAL_OPERATOR',
      email: 'operator@meridiansc.com',
      role: 'ROLE_FOUNDER',
      department: 'EXECUTIVE',
      allowedScopes: ['*'],
      tokenId: 'local_stdio_token',
      requestId: 'stdio_init',
      clientType: 'MCP_STDIO',
    };
  }

  logStderr(`Authenticated identity: ${userContext.email} (${userContext.role})`);

  const server = new Server(
    {
      name: 'jarvis-gateway',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. List available tools for this user's role & scopes
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logStderr(`Handling tools/list for user ${userContext?.email}`);
    const registered = ToolRegistry.listTools(userContext!);

    const tools = registered.map((t) => {
      let jsonSchema: any;
      try {
        jsonSchema = (zodToJsonSchema as any)(t.inputSchema);
        // Clean up $schema from sub-schema if present
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

  // 2. Execute tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logStderr(`Executing tool '${name}' with args: ${JSON.stringify(args)}`);

    try {
      const result = await ToolRegistry.executeTool(name, args || {}, userContext!);
      return result;
    } catch (err: any) {
      logStderr(`Tool execution failed: ${err.message}`);
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${err.message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logStderr('Jarvis MCP stdio transport connected and running.');
}

// Start if executed directly
startStdioServer().catch((err) => {
  logStderr(`Fatal error: ${err.stack || err.message}`);
  process.exit(1);
});

export { startStdioServer };
