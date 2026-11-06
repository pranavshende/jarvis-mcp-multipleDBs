import { UserRole } from '../config/permissions.js';

export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  department: string;
  allowedScopes: string[];
  tokenId: string;
  requestId: string;
  clientType: 'SLACK' | 'MCP_STREAM' | 'MCP_STDIO' | 'ADMIN_UI' | 'API';
}

declare module 'fastify' {
  interface FastifyRequest {
    userContext?: UserContext;
  }
}
