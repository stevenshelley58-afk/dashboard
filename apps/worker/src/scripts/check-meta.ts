import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

import { getPool } from "../db.js";

async function main() {
  const integrationId = process.argv[2];

  if (!integrationId) {
    console.error("Usage: tsx src/scripts/check-meta.ts <integration_id>");
    process.exitCode = 1;
    return;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const integrationResult = await client.query<{
      integration_id: string;
      account_id: string;
      ad_account_id: string | null;
      display_name: string | null;
    }>(
      `
        SELECT i.integration_id,
               i.account_id,
               i.ad_account_id,
               a.display_name
        FROM integrations i
        LEFT JOIN ad_accounts a ON a.ad_account_id = i.ad_account_id
        WHERE i.integration_id = $1
      `,
      [integrationId]
    );

    if (integrationResult.rowCount === 0) {
      console.error(`Integration ${integrationId} not found.`);
      process.exitCode = 1;
      return;
    }

    const integration = integrationResult.rows[0];
    if (!integration.ad_account_id) {
      console.error(`Integration ${integrationId} does not point to a Meta ad account.`);
      process.exitCode = 1;
      return;
    }

    const factStats = await client.query<{
      total_rows: number;
      first_date: string | null;
      last_date: string | null;
      spend_total: string | null;
      purchase_total: string | null;
    }>(
      `
        SELECT
          COUNT(*)::int AS total_rows,
          MIN(date)::text AS first_date,
          MAX(date)::text AS last_date,
          TO_CHAR(SUM(spend), 'FM9999990.00') AS spend_total,
          TO_CHAR(SUM(purchase_value), 'FM9999990.00') AS purchase_total
        FROM fact_meta_daily
        WHERE integration_id = $1
      `,
      [integrationId]
    );

    const metricsSample = await client.query<{
      date: string;
      spend: number;
      purchases: number;
      purchase_value: number;
      roas: number | null;
    }>(
      `
        SELECT
          date::text AS date,
          spend,
          purchases,
          purchase_value,
          roas
        FROM daily_meta_metrics
        WHERE ad_account_id = $1
        ORDER BY date DESC
        LIMIT 7
      `,
      [integration.ad_account_id]
    );

    console.log("Meta integration summary:");
    console.table([
      {
        integration_id: integration.integration_id,
        account_id: integration.account_id,
        ad_account_id: integration.ad_account_id,
        ad_account_name: integration.display_name ?? "(not set)",
      },
    ]);

    console.log("fact_meta_daily stats:");
    console.table(
      factStats.rows.map((row) => ({
        total_rows: row.total_rows,
        first_date: row.first_date,
        last_date: row.last_date,
        spend_total: row.spend_total ?? "0.00",
        purchase_total: row.purchase_total ?? "0.00",
      }))
    );

    console.log("Latest daily_meta_metrics rows:");
    console.table(
      metricsSample.rows.map((row) => ({
        date: row.date,
        spend: row.spend,
        purchases: row.purchases,
        purchase_value: row.purchase_value,
        roas: row.roas,
      }))
    );
  } catch (error) {
    console.error("Meta data check failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Unhandled error while checking Meta data", error);
  process.exitCode = 1;
});



