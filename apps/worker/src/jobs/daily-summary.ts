import type { PoolClient } from "pg";

export async function rebuildDailySummary(
  client: PoolClient,
  accountId: string,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM daily_summary
      WHERE account_id = $1
        AND date = ANY($2::date[])
    `,
    [accountId, dates]
  );

  await client.query(
    `
      WITH date_inputs AS (
        SELECT UNNEST($2::date[]) AS date
      ),
      shopify AS (
        SELECT
          date,
          SUM(revenue_net) AS revenue_net,
          SUM(orders) AS orders
        FROM daily_shopify_metrics
        WHERE account_id = $1
          AND date = ANY($2::date[])
        GROUP BY date
      ),
      meta AS (
        SELECT
          date,
          SUM(spend) AS spend
        FROM daily_meta_metrics
        WHERE account_id = $1
          AND date = ANY($2::date[])
        GROUP BY date
      )
      INSERT INTO daily_summary (
        account_id,
        date,
        revenue_net,
        meta_spend,
        mer,
        orders,
        aov
      )
      SELECT
        $1::uuid AS account_id,
        d.date,
        COALESCE(s.revenue_net, 0) AS revenue_net,
        COALESCE(m.spend, 0) AS meta_spend,
        CASE
          WHEN COALESCE(m.spend, 0) > 0 THEN COALESCE(s.revenue_net, 0) / COALESCE(m.spend, 0)
          ELSE NULL
        END AS mer,
        COALESCE(s.orders, 0) AS orders,
        CASE
          WHEN COALESCE(s.orders, 0) > 0 THEN COALESCE(s.revenue_net, 0) / COALESCE(s.orders, 0)
          ELSE 0
        END AS aov
      FROM date_inputs d
      LEFT JOIN shopify s ON s.date = d.date
      LEFT JOIN meta m ON m.date = d.date
    `,
    [accountId, dates]
  );
}



