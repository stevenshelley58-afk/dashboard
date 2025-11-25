import { NextRequest, NextResponse } from "next/server";

import { requireAccountIdFromRequest } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import type {
  HomeDashboardResponse,
  HomeKpis,
  HomePeriodPreset,
  HomePeriodRange,
  HomeTimeseriesPoint,
} from "@/types/home-dashboard";

export const dynamic = "force-dynamic";

const PERIOD_PRESETS: HomePeriodPreset[] = ["today", "yesterday", "last_7", "last_30"];
const PRESET_SET = new Set<HomePeriodPreset>(PERIOD_PRESETS);

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function startOfDayUtc(value = new Date()): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function clampNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  return fallback;
}

function parsePreset(value: string | null): HomePeriodPreset {
  if (value && PRESET_SET.has(value as HomePeriodPreset)) {
    return value as HomePeriodPreset;
  }
  return "last_7";
}

function computePeriodRange(preset: HomePeriodPreset): HomePeriodRange {
  const today = startOfDayUtc();
  const rangeEnd = new Date(today);
  const rangeStart = new Date(today);

  switch (preset) {
    case "today":
      break;
    case "yesterday":
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() - 1);
      break;
    case "last_7":
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
      break;
    case "last_30":
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);
      break;
    default:
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
      break;
  }

  return {
    preset,
    from: formatDateOnly(rangeStart),
    to: formatDateOnly(rangeEnd),
  };
}

async function fetchLatestKpis(accountId: string, preset: HomePeriodPreset): Promise<HomeKpis> {
  const pool = getDbPool();
  const result = await pool.query<{
    as_of: string | null;
    revenue_net: number | null;
    meta_spend: number | null;
    mer: number | null;
    roas: number | null;
    aov: number | null;
  }>(
    `
      SELECT as_of,
             revenue_net,
             meta_spend,
             mer,
             roas,
             aov
      FROM latest_kpis
      WHERE account_id = $1
        AND period = $2
      ORDER BY as_of DESC NULLS LAST
      LIMIT 1
    `,
    [accountId, preset]
  );

  if (result.rowCount === 0) {
    return {
      revenue_net: 0,
      meta_spend: 0,
      mer: 0,
      roas: 0,
      aov: 0,
      as_of: null,
    };
  }

  const row = result.rows[0];
  return {
    revenue_net: clampNumber(row.revenue_net),
    meta_spend: clampNumber(row.meta_spend),
    mer: clampNumber(row.mer),
    roas: clampNumber(row.roas),
    aov: clampNumber(row.aov),
    as_of: row.as_of,
  };
}

async function fetchDailySummary(params: {
  accountId: string;
  from: string;
  to: string;
}): Promise<Map<string, HomeTimeseriesPoint>> {
  const pool = getDbPool();
  const result = await pool.query<{
    date: string;
    revenue_net: number | null;
    meta_spend: number | null;
    mer: number | null;
  }>(
    `
      SELECT date::date AS date,
             revenue_net,
             meta_spend,
             mer
      FROM daily_summary
      WHERE account_id = $1
        AND date BETWEEN $2::date AND $3::date
      ORDER BY date ASC
    `,
    [params.accountId, params.from, params.to]
  );

  const map = new Map<string, HomeTimeseriesPoint>();
  for (const row of result.rows) {
    map.set(row.date, {
      date: row.date,
      revenue_net: clampNumber(row.revenue_net),
      meta_spend: clampNumber(row.meta_spend),
      mer: clampNumber(row.mer),
    });
  }
  return map;
}

function enumerateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return dates;
  }

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(formatDateOnly(cursor));
  }

  return dates;
}

function normalizeTimeseries(
  range: HomePeriodRange,
  rows: Map<string, HomeTimeseriesPoint>
): HomeTimeseriesPoint[] {
  const dates = enumerateDateRange(range.from, range.to);
  if (dates.length === 0) {
    return Array.from(rows.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  return dates.map((date) => {
    const row = rows.get(date);
    return (
      row ?? {
        date,
        revenue_net: 0,
        meta_spend: 0,
        mer: 0,
      }
    );
  });
}

async function resolveAccountCurrency(accountId: string): Promise<string> {
  const pool = getDbPool();

  const shopCurrency = await pool.query<{ currency: string | null }>(
    `
      SELECT s.currency
      FROM integrations i
      LEFT JOIN shops s ON s.shop_id = i.shop_id
      WHERE i.account_id = $1
        AND i.type = 'shopify'
        AND s.currency IS NOT NULL
      ORDER BY 
        CASE WHEN i.status = 'active' THEN 0 ELSE 1 END,
        i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );

  if (shopCurrency.rowCount && shopCurrency.rows[0].currency) {
    return shopCurrency.rows[0].currency!;
  }

  const metaCurrency = await pool.query<{ currency: string | null }>(
    `
      SELECT a.currency
      FROM integrations i
      LEFT JOIN ad_accounts a ON a.ad_account_id = i.ad_account_id
      WHERE i.account_id = $1
        AND i.type = 'meta'
        AND a.currency IS NOT NULL
      ORDER BY 
        CASE WHEN i.status IN ('active', 'connected') THEN 0 ELSE 1 END,
        i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );

  if (metaCurrency.rowCount && metaCurrency.rows[0].currency) {
    return metaCurrency.rows[0].currency!;
  }

  return "USD";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const accountId = requireAccountIdFromRequest(request);
    const preset = parsePreset(request.nextUrl.searchParams.get("period"));
    const range = computePeriodRange(preset);

    const [kpis, rows, currency] = await Promise.all([
      fetchLatestKpis(accountId, preset),
      fetchDailySummary({ accountId, from: range.from, to: range.to }),
      resolveAccountCurrency(accountId),
    ]);

    const timeseries = normalizeTimeseries(range, rows);

    const payload: HomeDashboardResponse = {
      period: range,
      kpis,
      timeseries,
      currency,
      meta: {
        hasData: timeseries.some(
          (point) =>
            point.revenue_net > 0 ||
            point.meta_spend > 0 ||
            Number.isFinite(point.mer) && point.mer > 0
        ),
      },
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to load home dashboard data", error);
    return NextResponse.json(
      { error: "Unexpected error fetching home dashboard data." },
      { status: 500 }
    );
  }
}




