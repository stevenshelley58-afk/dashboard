import { Pool } from 'pg';

declare global {
  var _webDbPool: Pool | undefined;
}

import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath, override: true });

const globalForDb = globalThis as typeof globalThis & {
  _webDbPool?: Pool;
};

function getPool(): Pool {
  if (globalForDb._webDbPool) {
    return globalForDb._webDbPool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Ensure the environment variable is configured.'
    );
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
  });

  // Always cache pool to prevent connection exhaustion in serverless environments
  globalForDb._webDbPool = pool;

  return pool;
}

export const getDbPool = getPool;

type HealthRow = { now: Date | string };

export async function healthCheck(): Promise<Date> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<HealthRow>('SELECT now() AS now');
    const value = rows[0]?.now ?? new Date().toISOString();
    return value instanceof Date ? value : new Date(value);
  } finally {
    client.release();
  }
}

