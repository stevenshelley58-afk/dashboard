/** Main worker class - polls and processes ETL jobs */
import { Pool, PoolConfig } from 'pg';
import { RunStatus, JobType, Platform, ErrorPayload } from '@dashboard/config';
import { logger } from './utils/logger.js';
import { ShopifyETL } from './etl/shopify.js';
import { MetaETL } from './etl/meta.js';
import { GA4ETL } from './etl/ga4.js';
import { KlaviyoETL } from './etl/klaviyo.js';
import * as dns from 'node:dns';

const log = logger('worker');

import type { ETLRunRecord } from './types/etl.js';

/**
 * Resolve an IPv4 address for the given host, trying environment overrides first.
 */
async function resolveIPv4Host(originalHost: string): Promise<string> {
  const manualOverride = process.env.SUPABASE_DB_IPV4 || (process.env.PGHOSTADDR && process.env.PGHOSTADDR !== '0.0.0.0' ? process.env.PGHOSTADDR : undefined);
  if (manualOverride) {
    log.info(`Using manually configured IPv4 host: ${manualOverride}`);
    return manualOverride;
  }

  const strategies: Array<() => Promise<string | null>> = [
    async () => {
      try {
        const { address } = await dns.promises.lookup(originalHost, { family: 4 });
        return address;
      } catch (error) {
        log.warn(`dns.lookup IPv4 failed for ${originalHost}`, error);
        return null;
      }
    },
    async () => {
      try {
        const addresses = await dns.promises.resolve4(originalHost);
        return addresses[0] ?? null;
      } catch (error) {
        log.warn(`dns.resolve4 failed for ${originalHost}`, error);
        return null;
      }
    },
    async () => {
      try {
        const resolver = new dns.promises.Resolver();
        resolver.setServers(['1.1.1.1', '8.8.8.8']);
        const addresses = await resolver.resolve4(originalHost);
        return addresses[0] ?? null;
      } catch (error) {
        log.warn(`Custom resolver resolve4 failed for ${originalHost}`, error);
        return null;
      }
    },
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result) {
      log.info(`Resolved ${originalHost} to IPv4: ${result}`);
      process.env.PGHOSTADDR = result;
      return result;
    }
  }

  throw new Error(
    `Unable to resolve IPv4 address for ${originalHost}. ` +
    `Set SUPABASE_DB_IPV4 or PGHOSTADDR in Railway variables to a valid IPv4 address.`
  );
}

/**
 * Create a PostgreSQL pool with IPv4 resolution to avoid IPv6 connectivity issues.
 * Resolves hostname to IPv4 address and preserves original hostname in TLS SNI.
 */
async function makeIPv4Pool(connStr: string): Promise<Pool> {
  const url = new URL(connStr);
  const originalHost = url.hostname;
  const ipv4Host = await resolveIPv4Host(originalHost);

  url.hostname = ipv4Host;

  const ssl = {
    rejectUnauthorized: false,
    servername: originalHost,
  } as const;

  const poolConfig: PoolConfig = {
    connectionString: url.toString(),
    host: ipv4Host,
    ssl,
    max: 1,
    connectionTimeoutMillis: 5000,
  };

  return new Pool(poolConfig);
}

export class Worker {
  private pool: Pool | null = null;
  private running: boolean = false;
  private pollInterval: number = 5000; // 5 seconds

  constructor() {
    const dbUrl = process.env.SUPABASE_DB_URL;
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL environment variable is required');
    }

    log.info('Worker initialized');
  }

  /**
   * Initialize database connection with IPv4 resolution
   */
  async initializeConnection(): Promise<void> {
    const dbUrl = process.env.SUPABASE_DB_URL;
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL environment variable is required');
    }

    try {
      // Close existing pool if it exists
      if (this.pool) {
        await this.pool.end().catch(() => {});
      }

      // Create pool with IPv4 resolution
      this.pool = await makeIPv4Pool(dbUrl);
      
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      log.info('Database connection established successfully');
    } catch (error) {
      log.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    // Initialize connection with IPv4 resolution
    await this.initializeConnection();
    
    this.running = true;
    log.info('Worker started, polling for jobs...');

    while (this.running) {
      try {
        await this.processNextJob();
        await this.sleep(this.pollInterval);
      } catch (error) {
        log.error('Error in worker loop:', error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  private async processNextJob(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const client = await this.pool.connect();

    try {
      // Find next QUEUED job (with partial unique index preventing duplicates)
      const result = await client.query<ETLRunRecord>(
        `SELECT * FROM core_warehouse.etl_runs 
         WHERE status = $1 
         ORDER BY created_at ASC 
         LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [RunStatus.QUEUED]
      );

      if (result.rows.length === 0) {
        return; // No jobs to process
      }

      const job = result.rows[0];
      log.info(`Processing job ${job.id}: ${job.platform} ${job.job_type} for shop ${job.shop_id}`);

      // Mark as IN_PROGRESS
      await client.query(
        `UPDATE core_warehouse.etl_runs 
         SET status = $1, started_at = now() 
         WHERE id = $2`,
        [RunStatus.IN_PROGRESS, job.id]
      );

      // Process the job
      await this.executeJob(job, client);
    } finally {
      client.release();
    }
  }

  private async executeJob(job: ETLRunRecord, client: any): Promise<void> {
    let recordsSynced = 0;
    let error: ErrorPayload | null = null;

    try {
      // Route to appropriate ETL processor
      const etl = this.getETLProcessor(job.platform);
      
      // Use transaction for atomicity
      await client.query('BEGIN');
      
      try {
        if (job.job_type === JobType.HISTORICAL) {
          recordsSynced = await etl.runHistorical(job.shop_id, client);
        } else {
          recordsSynced = await etl.runIncremental(job.shop_id, client);
        }

        // Commit transaction
        await client.query('COMMIT');
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw error;
      }

      // Update cursor on success
      if (recordsSynced > 0) {
        await this.updateCursor(job.shop_id, job.platform, client);
      }

      // Mark as SUCCEEDED
      await client.query(
        `UPDATE core_warehouse.etl_runs 
         SET status = $1, records_synced = $2, completed_at = now() 
         WHERE id = $3`,
        [RunStatus.SUCCEEDED, recordsSynced, job.id]
      );

      log.info(`Job ${job.id} completed successfully: ${recordsSynced} records synced`);
    } catch (err) {
      error = {
        code: this.getErrorCode(err),
        message: err instanceof Error ? err.message : String(err),
        service: 'apps/worker',
        task: `etl_${job.platform.toLowerCase()}`,
        stack_trace: err instanceof Error ? err.stack : undefined,
      };

      // Mark as FAILED - do NOT update cursor
      await client.query(
        `UPDATE core_warehouse.etl_runs 
         SET status = $1, error = $2, completed_at = now() 
         WHERE id = $3`,
        [RunStatus.FAILED, JSON.stringify(error), job.id]
      );

      log.error(`Job ${job.id} failed:`, error.message);
    }
  }

  private getETLProcessor(platform: Platform): ShopifyETL | MetaETL | GA4ETL | KlaviyoETL {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    switch (platform) {
      case Platform.SHOPIFY:
        return new ShopifyETL(this.pool);
      case Platform.META:
        return new MetaETL(this.pool);
      case Platform.GA4:
        return new GA4ETL(this.pool);
      case Platform.KLAVIYO:
        return new KlaviyoETL(this.pool);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async updateCursor(shopId: string, platform: Platform, client: any): Promise<void> {
    // Update sync cursor with current timestamp
    await client.query(
      `INSERT INTO core_warehouse.sync_cursors (shop_id, platform, cursor_value, last_success_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (shop_id, platform) 
       DO UPDATE SET cursor_value = $3, last_success_at = now(), updated_at = now()`,
      [shopId, platform, new Date().toISOString()]
    );
  }

  private getErrorCode(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('auth')) return 'AUTH_ERROR';
    if (message.includes('rate limit')) return 'RATE_LIMIT';
    if (message.includes('bulk')) return 'BULK_NOT_READY';
    if (message.includes('permission')) return 'PERMISSION_DENIED';
    if (message.includes('database')) return 'DB_WRITE_ERROR';
    if (message.includes('schema')) return 'SCHEMA_MISMATCH';
    
    return 'UNKNOWN';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pool) {
      await this.pool.end();
    }
    log.info('Worker stopped');
  }
}

