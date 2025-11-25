import { getDbPool } from "@/lib/db";
import { metaJobsEnabled } from "@/lib/job-config";

export async function enqueueMetaInitialFill(
  integrationId: string,
  trigger: "auto" | "user_click" | "system" = "auto"
): Promise<string | null> {
  if (!metaJobsEnabled()) {
    return null;
  }

  const pool = getDbPool();
  const result = await pool.query<{ sync_run_id: string }>(
    `
      INSERT INTO sync_runs (integration_id, job_type, status, trigger)
      VALUES ($1, 'meta_7d_fill', 'queued', $2)
      RETURNING sync_run_id
    `,
    [integrationId, trigger]
  );

  return result.rows[0]?.sync_run_id ?? null;
}



