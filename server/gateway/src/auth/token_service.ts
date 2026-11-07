import crypto from 'crypto';
import { pool } from '../config/db.js';
import { UserRole } from '../config/permissions.js';

export interface TokenRecord {
  id: string;
  userId: string;
  corporateEmail: string;
  tokenHash: string;
  tokenPrefix: string;
  tokenName: string;
  role: UserRole;
  department: string;
  allowedScopes: string[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export class TokenService {
  // In-memory cache for ultra-fast auth checks (< 5ms local validation)
  private static tokenCache: Map<string, { record: TokenRecord | null; cachedAt: number }> = new Map();
  private static CACHE_TTL_MS = 60 * 1000; // 1 minute

  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  public static generateToken(userHandle: string): string {
    const cleanHandle = userHandle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomSecret = crypto.randomBytes(16).toString('hex');
    return `msc_mcp_${cleanHandle}_${randomSecret}`;
  }

  public static async createToken(params: {
    userId: string;
    corporateEmail: string;
    tokenName: string;
    role: UserRole;
    department?: string;
    allowedScopes?: string[];
    expiresInDays?: number;
  }): Promise<{ tokenRecord: TokenRecord; rawToken: string }> {
    const rawToken = this.generateToken(params.userId);
    const tokenHash = this.hashToken(rawToken);
    const tokenPrefix = rawToken.substring(0, 18) + '...';
    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 86400 * 1000)
      : null;

    const query = `
      INSERT INTO jarvis_system.api_tokens 
        (user_id, corporate_email, token_hash, token_prefix, token_name, role, department, allowed_scopes, expires_at, status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
      RETURNING 
        id, user_id as "userId", corporate_email as "corporateEmail", token_hash as "tokenHash",
        token_prefix as "tokenPrefix", token_name as "tokenName", role, department,
        allowed_scopes as "allowedScopes", status, expires_at as "expiresAt",
        last_used_at as "lastUsedAt", created_at as "createdAt";
    `;

    const res = await pool.query(query, [
      params.userId,
      params.corporateEmail,
      tokenHash,
      tokenPrefix,
      params.tokenName,
      params.role,
      params.department || 'OPERATIONS',
      params.allowedScopes || ['read:metrics', 'read:knowledge'],
      expiresAt,
    ]);

    const record: TokenRecord = res.rows[0];
    this.tokenCache.set(tokenHash, { record, cachedAt: Date.now() });

    return { tokenRecord: record, rawToken };
  }

  public static async validateToken(rawToken: string): Promise<TokenRecord | null> {
    if (!rawToken || !rawToken.startsWith('msc_mcp_')) {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    const now = Date.now();

    // Check memory cache
    const cached = this.tokenCache.get(tokenHash);
    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      if (!cached.record) return null; // Cached negative lookup
      if (cached.record.status !== 'ACTIVE') return null;
      if (cached.record.expiresAt && cached.record.expiresAt.getTime() < now) return null;
      // Async update last_used_at
      pool.query('UPDATE jarvis_system.api_tokens SET last_used_at = NOW() WHERE token_hash = $1', [tokenHash]).catch(() => {});
      return cached.record;
    }

    // Query database
    const query = `
      SELECT 
        id, user_id as "userId", corporate_email as "corporateEmail", token_hash as "tokenHash",
        token_prefix as "tokenPrefix", token_name as "tokenName", role, department,
        allowed_scopes as "allowedScopes", status, expires_at as "expiresAt",
        last_used_at as "lastUsedAt", created_at as "createdAt"
      FROM jarvis_system.api_tokens
      WHERE token_hash = $1;
    `;

    const res = await pool.query(query, [tokenHash]);
    if (res.rows.length === 0) {
      this.tokenCache.set(tokenHash, { record: null, cachedAt: now }); // Cache negative
      return null;
    }

    const record: TokenRecord = res.rows[0];

    // Check status
    if (record.status !== 'ACTIVE') {
      this.tokenCache.set(tokenHash, { record: null, cachedAt: now });
      return null;
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt).getTime() < now) {
      await pool.query('UPDATE jarvis_system.api_tokens SET status = \'EXPIRED\' WHERE id = $1', [record.id]);
      record.status = 'EXPIRED';
      this.tokenCache.set(tokenHash, { record: null, cachedAt: now });
      return null;
    }

    // Cache valid record
    this.tokenCache.set(tokenHash, { record, cachedAt: now });

    // Update last_used_at asynchronously
    pool.query('UPDATE jarvis_system.api_tokens SET last_used_at = NOW() WHERE id = $1', [record.id]).catch(() => {});

    return record;
  }

  public static async revokeToken(tokenId: string): Promise<boolean> {
    const res = await pool.query(
      "UPDATE jarvis_system.api_tokens SET status = 'REVOKED', revoked_at = NOW() WHERE id = $1 RETURNING token_hash as \"tokenHash\"",
      [tokenId]
    );
    if (res.rows.length > 0) {
      this.tokenCache.delete(res.rows[0].tokenHash);
      return true;
    }
    return false;
  }

  public static async deleteToken(tokenId: string): Promise<boolean> {
    const res = await pool.query(
      'DELETE FROM jarvis_system.api_tokens WHERE id = $1 RETURNING token_hash as "tokenHash"',
      [tokenId]
    );
    if (res.rows.length > 0) {
      this.tokenCache.delete(res.rows[0].tokenHash);
      return true;
    }
    return false;
  }

  public static async rotateToken(tokenId: string): Promise<{ newRecord: TokenRecord; rawToken: string } | null> {
    // 1. Fetch current token
    const fetchRes = await pool.query(
      'SELECT user_id as "userId", corporate_email as "corporateEmail", token_name as "tokenName", role, department, allowed_scopes as "allowedScopes" FROM jarvis_system.api_tokens WHERE id = $1',
      [tokenId]
    );
    if (fetchRes.rows.length === 0) return null;
    const old = fetchRes.rows[0];

    // 2. Revoke old
    await this.revokeToken(tokenId);

    // 3. Create replacement
    const created = await this.createToken({
      userId: old.userId,
      corporateEmail: old.corporateEmail,
      tokenName: `${old.tokenName} (Rotated)`,
      role: old.role,
      department: old.department,
      allowedScopes: old.allowedScopes,
    });
    return { newRecord: created.tokenRecord, rawToken: created.rawToken };
  }

  public static async listTokens(limit = 50, offset = 0): Promise<TokenRecord[]> {
    const query = `
      SELECT 
        id, user_id as "userId", corporate_email as "corporateEmail", token_hash as "tokenHash",
        token_prefix as "tokenPrefix", token_name as "tokenName", role, department,
        allowed_scopes as "allowedScopes", status, expires_at as "expiresAt",
        last_used_at as "lastUsedAt", created_at as "createdAt"
      FROM jarvis_system.api_tokens
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const res = await pool.query(query, [limit, offset]);
    return res.rows;
  }
}
