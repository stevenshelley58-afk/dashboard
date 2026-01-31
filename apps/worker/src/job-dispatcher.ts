import type { Pool, PoolClient } from "pg";

import { getPool } from "./db.js";
import type { JobType } from "./job-types.js";
import { isKnownJobType } from "./job-types.js";
import { runMetaFreshJob, runMetaSevenDayFillJob } from "./jobs/meta.js";
import { runShopifyFreshJob, runShopifySevenDayFillJob, runShopifySessionsJob } from "./jobs/shopify.js";
import type { SyncRunRecord } from "./types/sync-run.js";
import { sleep } from "./utils/time.js";

interface JobResult {
  stats?: Record<string, unknown>;
}

type JobHandler = (run: SyncRunRecord, pool: Pool) => Promise<JobResult>;

const JOB_HANDLERS: Record<JobType, JobHandler> = {
  shopify_7d_fill: runShopifySevenDayFillJob,
  shopify_fresh: runShopifyFreshJob,
  shopify_sessions: runShopifySessionsJob,
  meta_7d_fill: runMetaSevenDayFillJob,
  meta_fresh: runMetaFreshJob,
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;

function getPollInterval(): number {
  const value = process.env.JOB_POLL_INTERVAL_MS;
  if (!value) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_INTERVAL_MS;
}

async function claimNextRun(client: PoolClient): Promise<SyncRunRecord | null> {
  const result = await client.query<SyncRunRecord>(
    `
      SELECT sync_run_id, integration_id, job_type, trigger, retry_count
      FROM sync_runs
      WHERE status = 'queued'
        AND (rate_limited IS DISTINCT FROM TRUE OR rate_limit_reset_at <= NOW())
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `
  );

  if (result.rowCount === 0) {
    return null;
  }

  const run = result.rows[0];

  await client.query(
    `
      UPDATE sync_runs
      SET status = 'running',
          started_at = NOW(),
          error_code = NULL,
          error_message = NULL
      WHERE sync_run_id = $1
    `,
    [run.sync_run_id]
  );

  return run;
}

async function completeRunSuccess(pool: Pool, runId: string, stats?: Record<string, unknown>): Promise<void> {
  await pool.query(
    `
      UPDATE sync_runs
      SET status = 'success',
          finished_at = NOW(),
          stats = $2::jsonb
      WHERE sync_run_id = $1
    `,
    [runId, stats ? JSON.stringify(stats) : JSON.stringify({})]
  );
}

function truncateErrorMessage(message: string): string {
  const MAX_LENGTH = 1_000;
  return message.length <= MAX_LENGTH ? message : `${message.slice(0, MAX_LENGTH)}…`;
}

async function completeRunError(pool: Pool, runId: string, error: unknown): Promise<void> {
  const message =
    error instanceof Error
      ? truncateErrorMessage(error.message || error.name)
      : truncateErrorMessage(String(error));

  await pool.query(
    `
      UPDATE sync_runs
      SET status = 'error',
          finished_at = NOW(),
          error_code = COALESCE(error_code, 'worker_error'),
          error_message = $2
      WHERE sync_run_id = $1
    `,
    [runId, message]
  );
}

function resolveHandler(jobType: JobType | string): JobHandler | null {
  if (!isKnownJobType(jobType)) {
    return null;
  }
  return JOB_HANDLERS[jobType];
}

async function runSingleJob(pool: Pool, run: SyncRunRecord): Promise<void> {
  const handler = resolveHandler(run.job_type);

  if (!handler) {
    console.error(`No job handler found for job_type=${run.job_type}`);
    await completeRunError(pool, run.sync_run_id, new Error(`Unknown job type: ${run.job_type}`));
    return;
  }

  try {
    const result = await handler(run, pool);
    await completeRunSuccess(pool, run.sync_run_id, result.stats);
  } catch (error) {
    console.error(
      `Job ${run.job_type} failed for sync_run_id=${run.sync_run_id}:`,
      error
    );
    await completeRunError(pool, run.sync_run_id, error);
  }
}

export async function startJobDispatcher(): Promise<never> {
  const pool = getPool();
  const pollIntervalMs = getPollInterval();

  console.log(
    `Worker dispatcher started (poll interval ${pollIntervalMs}ms). Waiting for sync_runs…`
  );

  for (;;) {
    let run: SyncRunRecord | null = null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      run = await claimNextRun(client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to claim next sync run", error);
    } finally {
      client.release();
    }

    if (!run) {
      await sleep(pollIntervalMs);
      continue;
    }

    await runSingleJob(pool, run);
  }
}


