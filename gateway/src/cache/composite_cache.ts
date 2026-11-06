import crypto from 'crypto';
import { pool } from '../config/db.js';
import { UserContext } from '../security/request_context.js';

export type CacheCategory = 'FINANCIAL_METRIC' | 'KNOWLEDGE_SOP' | 'USER_SPECIFIC';

export interface CacheEntry {
  cacheKey: string;
  queryText: string;
  category: CacheCategory;
  responsePayload: any;
  roleScope: string;
  allowedScopes: string[];
  userId?: string;
  etlWatermark: string;
  hitCount: number;
  createdAt: number;
  expiresAt: number;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  avgLatencyMs: number;
  estimatedTokenSavings: number;
  totalEntries: number;
}

export class CompositeCache {
  private static memoryCache = new Map<string, CacheEntry>();
  private static currentETLWatermark: string = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  private static watermarkLastFetched: number = 0;

  // Cache Analytics Counters
  private static totalRequests = 0;
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static totalHitLatencyMs = 0;
  private static estimatedTokenSavings = 0;

  /**
   * Fetch live ETL watermark from analytics.reconciliation_log (cached for 60s)
   */
  public static async getETLWatermark(): Promise<string> {
    const now = Date.now();
    if (now - this.watermarkLastFetched < 60000 && this.currentETLWatermark) {
      return this.currentETLWatermark;
    }

    try {
      const res = await pool.query(
        `SELECT COALESCE(MAX(reconciled_at), NOW()) as watermark FROM analytics.reconciliation_log WHERE status = 'SUCCESS';`
      );
      if (res.rows.length > 0 && res.rows[0].watermark) {
        this.currentETLWatermark = new Date(res.rows[0].watermark).toISOString();
      }
    } catch {
      // Fallback to daily partition anchor if DB is unreachable
      this.currentETLWatermark = new Date().toISOString().slice(0, 13) + ':00:00.000Z';
    }

    this.watermarkLastFetched = now;
    return this.currentETLWatermark;
  }

  /**
   * Deterministic SHA-256 Cache Key Construction
   */
  public static buildCacheKey(
    queryText: string,
    sanitizedParams: Record<string, any>,
    user: UserContext,
    etlWatermark: string,
    category: CacheCategory
  ): string {
    const normalizedQuery = queryText.trim().toLowerCase().replace(/\s+/g, ' ');
    const sortedScopes = [...(user.allowedScopes || [])].sort().join(',');
    const paramStr = JSON.stringify(sanitizedParams || {});
    
    // User-specific queries must isolate by user ID
    const userPartition = category === 'USER_SPECIFIC' ? user.userId : 'GLOBAL';

    const raw = `${normalizedQuery}|${paramStr}|${user.role}|${sortedScopes}|${userPartition}|${etlWatermark}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Lookup an entry in the composite cache
   */
  public static async get(
    queryText: string,
    sanitizedParams: Record<string, any>,
    user: UserContext,
    category: CacheCategory = 'KNOWLEDGE_SOP'
  ): Promise<{ hit: boolean; data?: any; latencyMs: number }> {
    const t0 = performance.now();
    this.totalRequests++;

    const watermark = await this.getETLWatermark();
    const cacheKey = this.buildCacheKey(queryText, sanitizedParams, user, watermark, category);

    // 1. Check Fast L1 In-Memory Cache
    const entry = this.memoryCache.get(cacheKey);
    const now = Date.now();

    if (entry) {
      // Expiration check
      if (now > entry.expiresAt) {
        this.memoryCache.delete(cacheKey);
      } else {
        // Strict Authorization verification: Verify caller has matching role & scopes
        const roleMatches = entry.roleScope === user.role || user.role === 'ROLE_FOUNDER' || user.role === 'ROLE_ADMIN';
        const scopesValid = entry.allowedScopes.every((s) => user.allowedScopes.includes(s));
        const userMatches = !entry.userId || entry.userId === user.userId;

        if (roleMatches && scopesValid && userMatches) {
          entry.hitCount++;
          this.cacheHits++;
          const latencyMs = performance.now() - t0;
          this.totalHitLatencyMs += latencyMs;
          this.estimatedTokenSavings += 450; // Average prompt token savings

          // Update Postgres asynchronously without blocking
          pool.query(
            `UPDATE jarvis_system.semantic_cache SET hit_count = hit_count + 1 WHERE cache_key = $1`,
            [cacheKey]
          ).catch(() => {});

          return { hit: true, data: entry.responsePayload, latencyMs };
        }
      }
    }

    // 2. Check L2 PostgreSQL Store
    try {
      const res = await pool.query(
        `SELECT response_payload, role_scope, allowed_scopes, user_id, expires_at 
         FROM jarvis_system.semantic_cache 
         WHERE cache_key = $1 AND expires_at > NOW();`,
        [cacheKey]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        const roleMatches = row.role_scope === user.role || user.role === 'ROLE_FOUNDER' || user.role === 'ROLE_ADMIN';
        const scopesValid = (row.allowed_scopes as string[]).every((s) => user.allowedScopes.includes(s));
        const userMatches = !row.user_id || row.user_id === user.userId;

        if (roleMatches && scopesValid && userMatches) {
          // Re-populate L1
          this.memoryCache.set(cacheKey, {
            cacheKey,
            queryText,
            category,
            responsePayload: row.response_payload,
            roleScope: row.role_scope,
            allowedScopes: row.allowed_scopes,
            userId: row.user_id,
            etlWatermark: watermark,
            hitCount: 1,
            createdAt: Date.now(),
            expiresAt: new Date(row.expires_at).getTime(),
          });

          this.cacheHits++;
          const latencyMs = performance.now() - t0;
          this.totalHitLatencyMs += latencyMs;
          this.estimatedTokenSavings += 450;
          return { hit: true, data: row.response_payload, latencyMs };
        }
      }
    } catch {}

    this.cacheMisses++;
    return { hit: false, latencyMs: performance.now() - t0 };
  }

  /**
   * Insert entry into composite cache
   */
  public static async set(
    queryText: string,
    sanitizedParams: Record<string, any>,
    user: UserContext,
    category: CacheCategory,
    responsePayload: any,
    ttlSeconds?: number
  ): Promise<string> {
    // Do NOT cache transient errors or downstream connection failures
    const strPayload = JSON.stringify(responsePayload || {});
    if (
      strPayload.includes('Knowledge retrieval failed') ||
      strPayload.includes('Failed to connect') ||
      strPayload.includes('Metric calculation failed') ||
      strPayload.includes('fetch failed')
    ) {
      return '';
    }

    const watermark = await this.getETLWatermark();
    const cacheKey = this.buildCacheKey(queryText, sanitizedParams, user, watermark, category);

    // TTL Policy:
    // Financial metrics: strictly 15 min (900s)
    // Knowledge/SOP: default 4 hours (14400s)
    // User-specific: default 1 hour (3600s)
    const effectiveTtl = ttlSeconds || (category === 'FINANCIAL_METRIC' ? 900 : category === 'USER_SPECIFIC' ? 3600 : 14400);
    const now = Date.now();
    const expiresAt = now + effectiveTtl * 1000;

    const entry: CacheEntry = {
      cacheKey,
      queryText,
      category,
      responsePayload,
      roleScope: user.role,
      allowedScopes: user.allowedScopes,
      userId: category === 'USER_SPECIFIC' ? user.userId : undefined,
      etlWatermark: watermark,
      hitCount: 0,
      createdAt: now,
      expiresAt,
    };

    // 1. Store in L1 memory
    this.memoryCache.set(cacheKey, entry);

    // Limit memory cache size to 1,000 entries
    if (this.memoryCache.size > 1000) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }

    // 2. Persist in L2 PostgreSQL
    try {
      await pool.query(
        `INSERT INTO jarvis_system.semantic_cache 
         (cache_key, query_text, category, response_payload, role_scope, allowed_scopes, user_id, etl_watermark, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (cache_key) DO UPDATE SET
           response_payload = EXCLUDED.response_payload,
           hit_count = jarvis_system.semantic_cache.hit_count + 1,
           expires_at = EXCLUDED.expires_at;`,
        [
          cacheKey,
          queryText,
          category,
          JSON.stringify(responsePayload),
          user.role,
          user.allowedScopes,
          entry.userId || null,
          watermark,
          new Date(expiresAt).toISOString(),
        ]
      );
    } catch (err) {
      console.error('[CACHE_SET_ERROR]', err);
    }

    return cacheKey;
  }

  /**
   * Invalidate cache on ETL synchronization or role/policy changes
   */
  public static async invalidate(
    scope: 'ALL' | 'FINANCIAL_ONLY' | 'ROLE' | 'KEY',
    targetValue?: string
  ): Promise<{ clearedCount: number; message: string }> {
    let clearedCount = 0;

    if (scope === 'ALL') {
      clearedCount = this.memoryCache.size;
      this.memoryCache.clear();
      await pool.query(`DELETE FROM jarvis_system.semantic_cache;`);
      return { clearedCount, message: 'Complete semantic cache purged.' };
    }

    if (scope === 'FINANCIAL_ONLY') {
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.category === 'FINANCIAL_METRIC') {
          this.memoryCache.delete(k);
          clearedCount++;
        }
      }
      await pool.query(`DELETE FROM jarvis_system.semantic_cache WHERE category = 'FINANCIAL_METRIC';`);
      return { clearedCount, message: 'All financial metric cache entries invalidated.' };
    }

    if (scope === 'ROLE' && targetValue) {
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.roleScope === targetValue) {
          this.memoryCache.delete(k);
          clearedCount++;
        }
      }
      await pool.query(`DELETE FROM jarvis_system.semantic_cache WHERE role_scope = $1;`, [targetValue]);
      return { clearedCount, message: `Cache entries for role '${targetValue}' invalidated.` };
    }

    if (scope === 'KEY' && targetValue) {
      this.memoryCache.delete(targetValue);
      await pool.query(`DELETE FROM jarvis_system.semantic_cache WHERE cache_key = $1;`, [targetValue]);
      return { clearedCount: 1, message: `Cache entry '${targetValue}' invalidated.` };
    }

    return { clearedCount: 0, message: 'No matching entries invalidated.' };
  }

  /**
   * Watermark-based invalidation triggered when ETL pipeline completes
   */
  public static async advanceETLWatermark(newWatermarkTimestamp: string): Promise<number> {
    this.currentETLWatermark = newWatermarkTimestamp;
    this.watermarkLastFetched = Date.now();
    const res = await this.invalidate('FINANCIAL_ONLY');
    return res.clearedCount;
  }

  /**
   * Cache operational analytics
   */
  public static getStats(): CacheStats {
    const hitRatio = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
    const avgLatencyMs = this.cacheHits > 0 ? this.totalHitLatencyMs / this.cacheHits : 0.85;

    return {
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRatio: Number(hitRatio.toFixed(2)),
      avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
      estimatedTokenSavings: this.estimatedTokenSavings,
      totalEntries: this.memoryCache.size,
    };
  }
}
