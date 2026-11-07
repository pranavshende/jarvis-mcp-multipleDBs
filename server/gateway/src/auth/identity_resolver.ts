import crypto from 'crypto';
import { TokenService } from './token_service.js';
import { UserAuthService } from './user_auth_service.js';
import { UserContext } from '../security/request_context.js';
import { pool } from '../config/db.js';
import { UserRole } from '../config/permissions.js';

export class IdentityResolver {
  public static async resolveFromToken(
    rawToken: string,
    clientType: 'SLACK' | 'MCP_STREAM' | 'MCP_STDIO' | 'ADMIN_UI' | 'API' = 'API',
    requestId?: string
  ): Promise<UserContext | null> {
    // 1. Check if token is a signed user session JWT
    const jwtUser = UserAuthService.verifyToken(rawToken);
    if (jwtUser) {
      return {
        userId: jwtUser.userId,
        email: jwtUser.email,
        role: 'FOUNDER' as UserRole,
        department: 'EXECUTIVE_OFFICE',
        allowedScopes: ['*'],
        tokenId: `jwt-${jwtUser.userId}`,
        requestId: requestId || crypto.randomUUID(),
        clientType,
      };
    }

    // 2. Fallback to API Token Service (msc_mcp_founder_sec_...)
    const record = await TokenService.validateToken(rawToken);
    if (!record) {
      return null;
    }

    // Ensure userId is a valid UUID for PostgreSQL conversations & session storage
    let resolvedUserId = record.userId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId);
    if (!isUuid) {
      try {
        const uRes = await pool.query('SELECT id FROM public.users WHERE LOWER(email) = $1 LIMIT 1', [record.corporateEmail.toLowerCase()]);
        if (uRes.rows.length > 0) {
          resolvedUserId = uRes.rows[0].id;
        } else {
          // Link to default executive founder user
          const defaultUser = await pool.query("SELECT id FROM public.users WHERE email = 'pranav@meridian.com' LIMIT 1");
          resolvedUserId = defaultUser.rows.length > 0 ? defaultUser.rows[0].id : 'a0000000-0000-0000-0000-000000000001';
        }
      } catch {
        resolvedUserId = 'a0000000-0000-0000-0000-000000000001';
      }
    }

    return {
      userId: resolvedUserId,
      email: record.corporateEmail,
      role: record.role,
      department: record.department,
      allowedScopes: record.allowedScopes,
      tokenId: record.id,
      requestId: requestId || crypto.randomUUID(),
      clientType,
    };
  }

  public static async resolveFromSlackUserId(
    slackUserId: string,
    slackEmail: string,
    requestId?: string
  ): Promise<UserContext | null> {
    // In strict security mode, map the verified Slack email to the employee record
    const query = `
      SELECT id, user_id as "userId", corporate_email as "corporateEmail", role, department, allowed_scopes as "allowedScopes"
      FROM jarvis_system.api_tokens
      WHERE corporate_email = $1 AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [slackEmail.toLowerCase().trim()]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      userId: row.userId,
      email: row.corporateEmail,
      role: row.role as UserRole,
      department: row.department,
      allowedScopes: row.allowedScopes,
      tokenId: row.id,
      requestId: requestId || crypto.randomUUID(),
      clientType: 'SLACK',
    };
  }

  public static async resolveInternal(
    userId: string,
    clientType: 'ADMIN_UI' | 'API' = 'ADMIN_UI',
    requestId?: string
  ): Promise<UserContext | null> {
    const query = `
      SELECT id, user_id as "userId", corporate_email as "corporateEmail", role, department, allowed_scopes as "allowedScopes"
      FROM jarvis_system.api_tokens
      WHERE (user_id = $1 OR corporate_email = $1) AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [userId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      userId: row.userId,
      email: row.corporateEmail,
      role: row.role as UserRole,
      department: row.department,
      allowedScopes: row.allowedScopes,
      tokenId: row.id,
      requestId: requestId || crypto.randomUUID(),
      clientType,
    };
  }
}
