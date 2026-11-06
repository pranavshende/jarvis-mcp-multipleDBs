import pg from 'pg';
import { config } from './environment.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.databaseUrl.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[GATEWAY_DB_POOL_ERROR]', err);
});
