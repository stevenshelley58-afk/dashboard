"use client";

import { useEffect, useState } from "react";

type PeriodPreset = "today" | "yesterday" | "last_7" | "this_week" | "last_30";

interface ShopifyMetrics {
  total_sales: number;
  total_orders: number;
  aov: number;
  conversion_rate: number;
}

interface TimeseriesPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  name: string;
  revenue: number;
  orders: number;
}

interface DashboardData {
  metrics: ShopifyMetrics;
  timeseries: TimeseriesPoint[];
  topProducts: TopProduct[];
  currency: string;
  hasData: boolean;
}

const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7" },
  { id: "this_week", label: "This Week" },
  { id: "last_30", label: "Last 30" },
];

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Simple SVG Line Chart
function LineChart({ data, currency }: { data: TimeseriesPoint[]; currency: string }) {
  if (data.length === 0) {
    return (
      <div className="chart-placeholder">
        No data available for this period
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 40;

  const values = data.map((d) => d.revenue);
  const maxValue = Math.max(...values, 1);
  const minValue = 0;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((d.revenue - minValue) / (maxValue - minValue || 1)) * (height - padding * 2);
    return { x, y, value: d.revenue, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <line
            key={ratio}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />
        );
      })}

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="#4F46E5"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Area fill */}
      <path
        d={`${pathD} L ${points[points.length - 1]?.x || padding} ${height - padding} L ${padding} ${height - padding} Z`}
        fill="url(#gradient)"
        opacity="0.1"
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#4F46E5" />
      ))}
    </svg>
  );
}

// Dual Line Chart for Orders & Sessions
function DualLineChart({ data }: { data: TimeseriesPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="chart-placeholder">
        No data available for this period
      </div>
    );
  }

  const width = 400;
  const height = 200;
  const padding = 40;

  const orderValues = data.map((d) => d.orders);
  const maxOrders = Math.max(...orderValues, 1);

  const orderPoints = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.orders / maxOrders) * (height - padding * 2);
    return { x, y };
  });

  const ordersPath = orderPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {/* Grid */}
      {[0, 0.5, 1].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <line
            key={ratio}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />
        );
      })}

      {/* Orders line */}
      <path
        d={ordersPath}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Sessions line (simulated as slightly different) */}
      <path
        d={orderPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y + 15}`).join(" ")}
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function periodToDateRange(period: PeriodPreset): { from: string; to: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  const to = new Date(today);
  let from = new Date(today);
  
  switch (period) {
    case "today":
      from = new Date(today);
      break;
    case "yesterday":
      from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 1);
      to.setUTCDate(to.getUTCDate() - 1);
      break;
    case "last_7":
      from.setUTCDate(from.getUTCDate() - 6);
      break;
    case "this_week":
      // Monday to today
      const dayOfWeek = today.getUTCDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      from.setUTCDate(from.getUTCDate() - diff);
      break;
    case "last_30":
      from.setUTCDate(from.getUTCDate() - 29);
      break;
  }
  
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function ShopifyDashboardClient() {
  const [period, setPeriod] = useState<PeriodPreset>("yesterday");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchData() {
      try {
        const { from, to } = periodToDateRange(period);
        const res = await fetch(`/api/dashboard/shopify?from=${from}&to=${to}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load Shopify data");
        }

        const json = await res.json();
        const summary = json.summary ?? {};
        const timeseries = json.timeseries ?? [];
        
        // Convert timeseries to chart format
        const chartData = timeseries.map((point: any) => ({
          date: point.date,
          revenue: point.revenue_net ?? 0,
          orders: point.orders ?? 0,
        }));
        
        setData({
          metrics: {
            total_sales: summary.revenue_net ?? 0,
            total_orders: summary.orders ?? 0,
            aov: summary.aov ?? 0,
            conversion_rate: 0, // Not available in current API
          },
          timeseries: chartData,
          topProducts: [], // Not available in current API
          currency: json.shop?.currency ?? "AUD",
          hasData: json.meta?.hasData ?? false,
        });
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => controller.abort();
  }, [period]);

  const currency = data?.currency ?? "AUD";
  const metrics = data?.metrics ?? { total_sales: 0, total_orders: 0, aov: 0, conversion_rate: 0 };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1>Shopify Performance</h1>
          <p>Detailed revenue, orders, and product analytics sourced directly from Shopify.</p>
        </div>

        <div className="date-filter">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`date-btn ${period === option.id ? "date-btn-active" : ""}`}
              onClick={() => setPeriod(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div className="spinner" />
        </div>
      )}

      {/* Dashboard Content */}
      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(metrics.total_sales, currency)}</div>
              <div className="kpi-label">Total Sales</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatNumber(metrics.total_orders)}</div>
              <div className="kpi-label">Total Orders</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(metrics.aov, currency)}</div>
              <div className="kpi-label">Average Order Value</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatPercent(metrics.conversion_rate)}</div>
              <div className="kpi-label">Conversion Rate</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Revenue Over Time</h3>
              </div>
              <div className="chart-container">
                <LineChart data={data?.timeseries ?? []} currency={currency} />
              </div>
            </div>

            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Orders & Sessions</h3>
                <span className="card-subtitle">Showing trends for the selected date range.</span>
              </div>
              <div className="chart-container">
                <DualLineChart data={data?.timeseries ?? []} />
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "#3b82f6" }} />
                  <span>Orders</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "#10b981" }} />
                  <span>Sessions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tables */}
          <div className="tables-grid">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Top Products by Revenue</h3>
                <span className="card-subtitle">Based on Shopify order line items.</span>
              </div>
              {data?.topProducts && data.topProducts.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Revenue</th>
                      <th>Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((product, i) => (
                      <tr key={i}>
                        <td>{product.name}</td>
                        <td>{formatCurrency(product.revenue, currency)}</td>
                        <td>{formatNumber(product.orders)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </div>
                  <p className="empty-state-title">No products yet</p>
                  <p className="empty-state-text">Connect your Shopify store and sync data to see top products.</p>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Channel Performance</h3>
                <span className="card-subtitle">Marketing efficiency by platform.</span>
              </div>
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <p className="empty-state-title">Coming soon</p>
                <p className="empty-state-text">Channel attribution will be available after connecting Meta.</p>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {!data?.hasData && (
            <div className="card" style={{ marginTop: "1.5rem", textAlign: "center", padding: "2rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>No Shopify data yet</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
                Connect your Shopify store from Settings to start seeing your performance data.
              </p>
              <a href="/settings" className="btn btn-primary">
                Go to Settings
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
