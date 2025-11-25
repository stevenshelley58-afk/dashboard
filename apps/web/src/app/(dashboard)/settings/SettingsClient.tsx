"use client";

import { useEffect, useState, useCallback } from "react";

interface Integration {
  integration_id: string;
  type: "shopify" | "meta";
  status: string;
  created_at: string;
  updated_at: string;
  shop_name?: string;
  myshopify_domain?: string;
  ad_account_name?: string;
  platform_ad_account_id?: string;
}

interface SyncRun {
  sync_run_id: string;
  integration_id: string;
  job_type: string;
  status: string;
  trigger: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  rows_processed: number | null;
  created_at: string;
}

interface SyncCursor {
  job_type: string;
  cursor_key: string;
  cursor_value: string;
  updated_at: string;
}

interface DataStats {
  orders_count: number;
  latest_order_date: string | null;
  webhooks_count: number;
  latest_webhook: string | null;
}

interface IntegrationDetail {
  integration: Integration;
  recentSyncs: SyncRun[];
  cursors: SyncCursor[];
  dataStats: DataStats;
}

interface SettingsData {
  accountId: string;
  integrations: IntegrationDetail[];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatDate(dateStr);
}

function StatusBadge({ status }: { status: string }) {
  const getClass = () => {
    switch (status) {
      case "connected":
      case "completed":
      case "active":
        return "status-connected";
      case "error":
      case "failed":
      case "disconnected":
        return "status-disconnected";
      case "running":
      case "queued":
        return "status-pending";
      default:
        return "status-pending";
    }
  };
  
  return (
    <span className={`status-badge ${getClass()}`}>
      {status}
    </span>
  );
}

function IntegrationCard({ detail, onSync, syncing }: { 
  detail: IntegrationDetail; 
  onSync: (integrationId: string, jobType: string) => void;
  syncing: string | null;
}) {
  const { integration, recentSyncs, cursors, dataStats } = detail;
  const isShopify = integration.type === "shopify";
  const [expanded, setExpanded] = useState(false);
  
  const lastSuccessfulSync = recentSyncs.find(s => s.status === "completed");
  const lastFailedSync = recentSyncs.find(s => s.status === "failed" || s.status === "error");
  
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div className="connection-icon">
            {isShopify ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem" }}>
                {isShopify ? "Shopify" : "Meta Ads"}
              </h3>
              <StatusBadge status={integration.status} />
            </div>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              {isShopify 
                ? (integration.shop_name || integration.myshopify_domain || "Not connected")
                : (integration.ad_account_name || integration.platform_ad_account_id || "Not connected")
              }
            </p>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-secondary"
            onClick={() => onSync(integration.integration_id, isShopify ? "shopify_fresh" : "meta_fresh")}
            disabled={syncing === integration.integration_id}
            style={{ fontSize: "0.8125rem" }}
          >
            {syncing === integration.integration_id ? "Syncing..." : "Sync Now"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: "0.8125rem" }}
          >
            {expanded ? "Hide Details" : "Show Details"}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(4, 1fr)", 
        gap: "1rem", 
        padding: "1rem",
        background: "var(--background)",
        borderRadius: "0.5rem",
        marginBottom: expanded ? "1rem" : 0
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Last Sync</div>
          <div style={{ fontWeight: "600", marginTop: "0.25rem" }}>
            {formatRelativeTime(lastSuccessfulSync?.completed_at)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Data Through</div>
          <div style={{ fontWeight: "600", marginTop: "0.25rem" }}>
            {isShopify 
              ? (dataStats.latest_order_date ? formatDate(dataStats.latest_order_date) : "No data")
              : "N/A"
            }
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {isShopify ? "Orders Synced" : "Days Synced"}
          </div>
          <div style={{ fontWeight: "600", marginTop: "0.25rem" }}>
            {isShopify ? dataStats.orders_count.toLocaleString() : "0"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {isShopify ? "Webhooks Received" : "API Calls"}
          </div>
          <div style={{ fontWeight: "600", marginTop: "0.25rem" }}>
            {isShopify ? dataStats.webhooks_count.toLocaleString() : "0"}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Recent Sync History */}
          <div>
            <h4 style={{ fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Recent Sync History</h4>
            {recentSyncs.length > 0 ? (
              <div style={{ border: "1px solid var(--border-color)", borderRadius: "0.5rem", overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Type</th>
                      <th>Status</th>
                      <th>Trigger</th>
                      <th>Started</th>
                      <th>Rows</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSyncs.slice(0, 5).map((sync) => (
                      <tr key={sync.sync_run_id}>
                        <td><code style={{ fontSize: "0.75rem" }}>{sync.job_type}</code></td>
                        <td><StatusBadge status={sync.status} /></td>
                        <td style={{ fontSize: "0.8125rem" }}>{sync.trigger}</td>
                        <td style={{ fontSize: "0.8125rem" }}>{formatRelativeTime(sync.started_at || sync.created_at)}</td>
                        <td style={{ fontSize: "0.8125rem" }}>{sync.rows_processed ?? "-"}</td>
                        <td style={{ fontSize: "0.75rem", color: "var(--error)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sync.error_message || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No sync history yet</p>
            )}
          </div>

          {/* Sync Cursors */}
          {cursors.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Sync Cursors (Internal State)</h4>
              <div style={{ 
                background: "var(--background)", 
                borderRadius: "0.5rem", 
                padding: "0.75rem",
                fontFamily: "monospace",
                fontSize: "0.75rem"
              }}>
                {cursors.map((cursor, i) => (
                  <div key={i} style={{ marginBottom: i < cursors.length - 1 ? "0.5rem" : 0 }}>
                    <span style={{ color: "var(--text-muted)" }}>{cursor.job_type}.</span>
                    <span style={{ color: "var(--primary)" }}>{cursor.cursor_key}</span>
                    <span style={{ color: "var(--text-muted)" }}> = </span>
                    <span>{cursor.cursor_value}</span>
                    <span style={{ color: "var(--text-light)", marginLeft: "0.5rem" }}>
                      (updated {formatRelativeTime(cursor.updated_at)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={() => onSync(integration.integration_id, isShopify ? "shopify_7d_fill" : "meta_7d_fill")}
              disabled={syncing === integration.integration_id}
            >
              Backfill Last 7 Days
            </button>
            {isShopify && integration.status === "connected" && (
              <a href={`/api/shopify/install?shop=${integration.myshopify_domain}`} className="btn btn-secondary">
                Reinstall Webhooks
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectShopifyCard() {
  const [shop, setShop] = useState("");
  
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <div className="connection-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Connect Shopify Store</h3>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Sync orders, products, and customers from your Shopify store.
          </p>
        </div>
      </div>
      
      <form
        action="/api/shopify/install"
        method="GET"
        style={{ display: "flex", gap: "0.75rem" }}
      >
        <input
          type="text"
          name="shop"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="your-store.myshopify.com"
          required
          className="input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary">
          Connect Store
        </button>
      </form>
      
      <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <strong>What gets synced:</strong>
        <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
          <li>Orders and order line items</li>
          <li>Customers and customer data</li>
          <li>Products and inventory</li>
          <li>Real-time webhooks for new orders</li>
        </ul>
      </div>
    </div>
  );
}

function ConnectMetaCard() {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <div className="connection-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Connect Meta Ads</h3>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Sync Facebook and Instagram advertising data.
          </p>
        </div>
      </div>
      
      <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
        <strong>Coming Soon:</strong> Meta Ads integration is under development. 
        Enter your API credentials below to enable when ready.
      </div>
      
      <div style={{ 
        background: "var(--background)", 
        borderRadius: "0.5rem", 
        padding: "1rem",
        fontSize: "0.875rem"
      }}>
        <p style={{ marginBottom: "0.75rem", fontWeight: "500" }}>Required API Credentials:</p>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <div>
            <label className="label">Meta App ID</label>
            <input type="text" className="input" placeholder="Your Meta App ID" disabled />
          </div>
          <div>
            <label className="label">Meta App Secret</label>
            <input type="password" className="input" placeholder="Your Meta App Secret" disabled />
          </div>
          <div>
            <label className="label">Ad Account ID</label>
            <input type="text" className="input" placeholder="act_123456789" disabled />
          </div>
        </div>
        <button className="btn btn-primary" disabled style={{ marginTop: "1rem" }}>
          Connect Meta Ads (Coming Soon)
        </button>
      </div>
    </div>
  );
}

export default function SettingsClient() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/integrations");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load settings");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async (integrationId: string, jobType: string) => {
    setSyncing(integrationId);
    setSyncMessage(null);
    
    try {
      const res = await fetch("/api/settings/manual-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: integrationId, job_type: jobType }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to trigger sync");
      }
      
      const result = await res.json();
      setSyncMessage(`Sync job queued: ${result.sync_run_id || jobType}`);
      
      // Refresh data after a short delay
      setTimeout(fetchData, 2000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const shopifyIntegrations = data?.integrations.filter(i => i.integration.type === "shopify") ?? [];
  const metaIntegrations = data?.integrations.filter(i => i.integration.type === "meta") ?? [];
  const hasShopify = shopifyIntegrations.length > 0;
  const hasMeta = metaIntegrations.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1>Settings & Integrations</h1>
          <p>Manage your connected platforms, API keys, and sync status.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          <strong>Error:</strong> {error}
          <button 
            onClick={fetchData}
            style={{ marginLeft: "1rem", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Sync Message */}
      {syncMessage && (
        <div className={`alert ${syncMessage.includes("failed") || syncMessage.includes("Error") ? "alert-error" : "alert-success"}`} style={{ marginBottom: "1rem" }}>
          {syncMessage}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div className="spinner" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {/* Connected Integrations */}
          {(hasShopify || hasMeta) && (
            <section style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
                Connected Integrations
              </h2>
              
              {shopifyIntegrations.map((detail) => (
                <IntegrationCard 
                  key={detail.integration.integration_id} 
                  detail={detail} 
                  onSync={handleSync}
                  syncing={syncing}
                />
              ))}
              
              {metaIntegrations.map((detail) => (
                <IntegrationCard 
                  key={detail.integration.integration_id} 
                  detail={detail} 
                  onSync={handleSync}
                  syncing={syncing}
                />
              ))}
            </section>
          )}

          {/* Add New Integrations */}
          <section>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
              {hasShopify || hasMeta ? "Add More Integrations" : "Connect Your Platforms"}
            </h2>
            
            {!hasShopify && <ConnectShopifyCard />}
            {!hasMeta && <ConnectMetaCard />}
            
            {hasShopify && !hasMeta && (
              <ConnectMetaCard />
            )}
          </section>

          {/* Account Info */}
          <section style={{ marginTop: "2rem" }}>
            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Account Information</h3>
              <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.875rem" }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Account ID: </span>
                  <code style={{ 
                    background: "var(--background)", 
                    padding: "0.125rem 0.5rem", 
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem"
                  }}>
                    {data?.accountId || "Loading..."}
                  </code>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Total Integrations: </span>
                  <span>{data?.integrations.length ?? 0}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Help Section */}
          <section style={{ marginTop: "2rem" }}>
            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Need Help?</h3>
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                <p style={{ marginBottom: "0.75rem" }}>
                  <strong>Sync not working?</strong> Try clicking "Backfill Last 7 Days" to re-sync historical data.
                </p>
                <p style={{ marginBottom: "0.75rem" }}>
                  <strong>Missing webhooks?</strong> Click "Reinstall Webhooks" to re-register webhook subscriptions with Shopify.
                </p>
                <p>
                  <strong>Data looks wrong?</strong> Check the sync history above for any error messages.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

