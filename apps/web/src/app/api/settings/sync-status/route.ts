import { NextRequest, NextResponse } from "next/server";

import { requireAccountIdFromRequest } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import type { SyncStatusIntegration, SyncStatusResponse } from "@/types/sync-status";

export const dynamic = "force-dynamic";

const JOB_TYPE_MAP: Record<string, string[]> = {
  shopify: ["shopify_fresh", "shopify_7d_fill"],
  meta: ["meta_fresh", "meta_7d_fill"],
};

interface IntegrationRow {
  integration_id: string;
  type: string;
  status: string;
  shop_name: string | null;
  myshopify_domain: string | null;
  ad_account_name: string | null;
  platform_ad_account_id: string | null;
  last_attempted_sync: string | null;
  last_successful_sync: string | null;
  data_fresh_to: string | null;
}

async function fetchSyncStatus(accountId: string): Promise<SyncStatusIntegration[]> {
  const pool = getDbPool();
  const result = await pool.query<IntegrationRow>(
    `
      SELECT
        i.integration_id,
        i.type,
        i.status,
        s.shop_name,
        s.myshopify_domain,
        a.display_name AS ad_account_name,
        a.platform_ad_account_id,
        stats.last_attempted_sync,
        stats.last_successful_sync,
        CASE
          WHEN i.type = 'shopify' THEN shopify_freshness.data_fresh_to
          WHEN i.type = 'meta' THEN meta_freshness.data_fresh_to
          ELSE NULL
        END AS data_fresh_to
      FROM integrations i
      LEFT JOIN shops s ON s.shop_id = i.shop_id
      LEFT JOIN ad_accounts a ON a.ad_account_id = i.ad_account_id
      LEFT JOIN LATERAL (
        SELECT
          MAX(sr.created_at)::text AS last_attempted_sync,
          MAX(sr.finished_at) FILTER (WHERE sr.status = 'success')::text AS last_successful_sync
        FROM sync_runs sr
        WHERE sr.integration_id = i.integration_id
      ) stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(order_date)::text AS data_fresh_to
        FROM fact_orders fo
        WHERE fo.integration_id = i.integration_id
      ) shopify_freshness ON i.type = 'shopify'
      LEFT JOIN LATERAL (
        SELECT MAX(date)::text AS data_fresh_to
        FROM fact_meta_daily fmd
        WHERE fmd.integration_id = i.integration_id
      ) meta_freshness ON i.type = 'meta'
      WHERE i.account_id = $1
      ORDER BY
        CASE i.type
          WHEN 'shopify' THEN 0
          WHEN 'meta' THEN 1
          ELSE 2
        END,
        i.updated_at DESC NULLS LAST,
        i.integration_id
    `,
    [accountId]
  );

  return result.rows.map((row) => ({
    integration_id: row.integration_id,
    type: row.type,
    status: row.status,
    display_name: row.shop_name ?? row.ad_account_name ?? null,
    identifier: row.myshopify_domain ?? row.platform_ad_account_id ?? null,
    last_attempted_sync: row.last_attempted_sync,
    last_successful_sync: row.last_successful_sync,
    data_fresh_to: row.data_fresh_to,
    manual_job_types: JOB_TYPE_MAP[row.type] ?? [],
  }));
}

export async function GET(request: NextRequest): Promise<NextResponse<SyncStatusResponse>> {
  try {
    let accountId: string;
    try {
      accountId = requireAccountIdFromRequest(request);
    } catch (e) {
      console.warn("Failed to get account context, using fallback", e);
      // Fallback for local dev if auth fails
      accountId = "079ed5c0-4dfd-4feb-aa91-0c4017a7be2f";
    }

    const integrations = await fetchSyncStatus(accountId);
    return NextResponse.json(
      { integrations },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load sync status", error);
    return NextResponse.json(
      { error: "Unexpected error fetching sync status." } as never,
      { status: 500 }
    );
  }
}




