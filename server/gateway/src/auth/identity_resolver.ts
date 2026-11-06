import crypto from 'crypto';
import { TokenService } from './token_service.js';
import { UserContext } from '../security/request_context.js';
import { pool } from '../config/db.js';
import { UserRole } from '../config/permissions.js';

export class IdentityResolver {
  public static async resolveFromToken(
    rawToken: string,
    clientType: 'SLACK' | 'MCP_STREAM' | 'MCP_STDIO' | 'ADMIN_UI' | 'API' = 'API',
    requestId?: string
  ): Promise<UserContext | null> {
    const record = await TokenService.validateToken(rawToken);
    if (!record) {
      return null;
    }

    return {
      userId: record.userId,
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
