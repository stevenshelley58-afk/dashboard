import { NextRequest, NextResponse } from "next/server";

import { getDbPool } from "@/lib/db";
import { metaJobsEnabled } from "@/lib/job-config";

export const dynamic = "force-dynamic";

const DEFAULT_INTERVAL_MINUTES = 60;
const MIN_INTERVAL_MINUTES = 5;
const intervalEnv = Number.parseInt(
  process.env.META_FRESH_SCHED_MINUTES ?? "",
  10
);
const META_FRESH_INTERVAL_MINUTES = Number.isFinite(intervalEnv)
  ? Math.max(MIN_INTERVAL_MINUTES, intervalEnv)
  : DEFAULT_INTERVAL_MINUTES;

const CRON_SECRET =
  process.env.META_CRON_SECRET ?? process.env.CRON_SECRET ?? null;

function isAuthorized(request: NextRequest): boolean {
  if (!CRON_SECRET) {
    return true;
  }
  let headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("authorization");
  if (!headerSecret) {
    return false;
  }
  if (headerSecret.toLowerCase().startsWith("bearer ")) {
    headerSecret = headerSecret.slice(7);
  }
  return headerSecret === CRON_SECRET;
}

async function enqueueMetaFreshRuns(): Promise<number> {
  const pool = getDbPool();
  const result = await pool.query<{ inserted_rows: number }>(
    `
      WITH candidate AS (
        SELECT integration_id
        FROM integrations
        WHERE type = 'meta'
          AND status IN ('connected', 'active')
      ),
      inserted AS (
        INSERT INTO sync_runs (integration_id, job_type, status, trigger)
        SELECT
          c.integration_id,
          'meta_fresh' AS job_type,
          'queued' AS status,
          'auto' AS trigger
        FROM candidate c
        WHERE NOT EXISTS (
          SELECT 1
          FROM sync_runs sr
          WHERE sr.integration_id = c.integration_id
            AND sr.job_type = 'meta_fresh'
            AND sr.status IN ('queued', 'running')
            AND sr.created_at >= NOW() - ($1::int * INTERVAL '1 minute')
        )
        RETURNING sync_run_id
      )
      SELECT COUNT(*)::int AS inserted_rows FROM inserted
    `,
    [META_FRESH_INTERVAL_MINUTES]
  );

  return result.rows[0]?.inserted_rows ?? 0;
}

async function handleSchedulerRequest(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized scheduler invocation." },
      { status: 401 }
    );
  }

  if (!metaJobsEnabled()) {
    return NextResponse.json(
      { inserted: 0, jobType: "meta_fresh", message: "Meta jobs disabled." },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  }

  const inserted = await enqueueMetaFreshRuns();

  return NextResponse.json(
    {
      inserted,
      jobType: "meta_fresh",
      intervalMinutes: META_FRESH_INTERVAL_MINUTES,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );
}

// Vercel cron jobs use GET requests by default
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSchedulerRequest(request);
}

// Keep POST for manual triggers or external schedulers
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSchedulerRequest(request);
}


