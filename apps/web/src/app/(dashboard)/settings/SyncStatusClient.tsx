"use client";

import { useEffect, useMemo, useState } from "react";

import type { SyncStatusIntegration, SyncStatusResponse } from "@/types/sync-status";

interface PendingJobsMap {
  [jobKey: string]: boolean;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "pending";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return dateFormatter.format(parsed);
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return timestampFormatter.format(parsed);
}

function describeStatus(status: string): { label: string; tone: "success" | "warning" | "neutral" } {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized === "active" || normalized === "connected") {
    return { label: "Connected", tone: "success" };
  }
  if (normalized === "error" || normalized === "failed") {
    return { label: "Error", tone: "warning" };
  }
  return { label: status || "Unknown", tone: "neutral" };
}

function jobLabel(jobType: string): string {
  if (jobType.endsWith("fresh")) {
    return "Sync latest data";
  }
  if (jobType.includes("7d")) {
    return "Backfill 7 days";
  }
  return `Run ${jobType}`;
}

function jobDescription(jobType: string): string {
  if (jobType.endsWith("fresh")) {
    return "Fetches the newest data since the last successful sync.";
  }
  if (jobType.includes("7d")) {
    return "Reprocesses the last 7 days to fix gaps.";
  }
  return "Manual sync run.";
}

function StatusBadge(props: { status: string }) {
  const descriptor = describeStatus(props.status);
  const toneColor =
    descriptor.tone === "success"
      ? "rgba(34,197,94,0.15)"
      : descriptor.tone === "warning"
        ? "rgba(248,113,113,0.15)"
        : "rgba(255,255,255,0.15)";
  const borderColor =
    descriptor.tone === "success"
      ? "rgba(34,197,94,0.4)"
      : descriptor.tone === "warning"
        ? "rgba(248,113,113,0.4)"
        : "rgba(255,255,255,0.25)";
  return (
    <span
      style={{
        borderRadius: "999px",
        padding: "0.15rem 0.75rem",
        fontSize: "0.85rem",
        border: `1px solid ${borderColor}`,
        backgroundColor: toneColor,
      }}
    >
      {descriptor.label}
    </span>
  );
}

export default function SyncStatusClient() {
  const [integrations, setIntegrations] = useState<SyncStatusIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingJobs, setPendingJobs] = useState<PendingJobsMap>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const response = await fetch("/api/settings/sync-status", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as Partial<SyncStatusResponse>;
        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Failed to load sync status.";
          throw new Error(message);
        }

        setIntegrations(Array.isArray(payload.integrations) ? payload.integrations : []);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to fetch sync status", err);
        setError(err instanceof Error ? err.message : "Unable to load sync status.");
        setIntegrations([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, [reloadKey]);

  const jobPending = useMemo(() => pendingJobs, [pendingJobs]);

  async function triggerManualSync(integrationId: string, jobType: string) {
    const jobKey = `${integrationId}:${jobType}`;
    setPendingJobs((current) => ({ ...current, [jobKey]: true }));
    setToast(null);

    try {
      const response = await fetch("/api/settings/manual-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: integrationId, job_type: jobType }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Manual sync failed.";
        throw new Error(message);
      }

      const syncRunId =
        payload && typeof payload === "object" && "syncRunId" in payload
          ? (payload as { syncRunId?: string }).syncRunId
          : undefined;

      setToast(
        syncRunId
          ? `Enqueued ${jobType} (${syncRunId.slice(0, 8)}…). Worker will pick it up shortly.`
          : `Enqueued ${jobType}. Worker will pick it up shortly.`
      );
      setReloadKey((value) => value + 1);
    } catch (err) {
      console.error("Manual sync failed", err);
      setError(err instanceof Error ? err.message : "Unable to enqueue manual sync.");
    } finally {
      setPendingJobs((current) => {
        const copy = { ...current };
        delete copy[jobKey];
        return copy;
      });
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--foreground)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Sync Status</h1>
          <p style={{ marginTop: "0.25rem", opacity: 0.8 }}>
            Track the freshness of each integration and trigger manual syncs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
          style={{
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.4)",
            padding: "0.5rem 1rem",
            backgroundColor: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {toast ? (
        <div
          style={{
            border: "1px solid rgba(34,197,94,0.4)",
            borderRadius: "0.65rem",
            padding: "0.75rem 1rem",
            backgroundColor: "rgba(34,197,94,0.1)",
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            border: "1px solid rgba(239,68,68,0.5)",
            background: "rgba(239,68,68,0.1)",
            borderRadius: "0.65rem",
            padding: "0.75rem 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadKey((value) => value + 1);
            }}
            style={{
              borderRadius: "0.45rem",
              border: "none",
              padding: "0.55rem 1rem",
              backgroundColor: "rgba(239,68,68,0.9)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            border: "1px dashed rgba(255,255,255,0.25)",
            borderRadius: "0.65rem",
            padding: "0.85rem 1rem",
            opacity: 0.8,
          }}
        >
          Loading integration statuses…
        </div>
      ) : null}

      {!loading && integrations.length === 0 ? (
        <p style={{ margin: 0, opacity: 0.8 }}>
          No integrations connected yet. Connect Shopify or Meta to start syncing data.
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {integrations.map((integration) => {
          const name =
            integration.display_name ??
            (integration.type === "shopify" ? "Shopify store" : "Meta account");
          const identifier = integration.identifier ?? "—";

          return (
            <div
              key={integration.integration_id}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "0.75rem",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "0.85rem", textTransform: "uppercase", opacity: 0.7 }}>
                    {integration.type === "shopify" ? "Shopify" : integration.type === "meta" ? "Meta" : "Integration"}
                  </p>
                  <h3 style={{ margin: "0.1rem 0" }}>{name}</h3>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: "0.9rem",
                      opacity: 0.8,
                    }}
                  >
                    {identifier}
                  </p>
                </div>
                <StatusBadge status={integration.status} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <StatBlock label="Data fresh to" value={formatDateOnly(integration.data_fresh_to)} />
                <StatBlock label="Last successful sync" value={formatTimestamp(integration.last_successful_sync)} />
                <StatBlock label="Last attempt" value={formatTimestamp(integration.last_attempted_sync)} />
              </div>

              {integration.manual_job_types.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  {integration.manual_job_types.map((jobType) => {
                    const jobKey = `${integration.integration_id}:${jobType}`;
                    const pending = Boolean(jobPending[jobKey]);
                    return (
                      <button
                        key={jobType}
                        type="button"
                        onClick={() => triggerManualSync(integration.integration_id, jobType)}
                        disabled={pending}
                        style={{
                          borderRadius: "0.5rem",
                          border: "1px solid rgba(255,255,255,0.25)",
                          padding: "0.6rem 1rem",
                          backgroundColor: pending ? "rgba(255,255,255,0.1)" : "transparent",
                          color: "inherit",
                          cursor: pending ? "not-allowed" : "pointer",
                          textAlign: "left",
                          minWidth: "180px",
                        }}
                        title={jobDescription(jobType)}
                      >
                        {pending ? "Enqueuing…" : jobLabel(jobType)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.75 }}>
                  Manual sync is not available for this integration type yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatBlock(props: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "0.65rem",
        padding: "0.65rem",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7, textTransform: "uppercase" }}>{props.label}</p>
      <p style={{ margin: "0.3rem 0 0", fontWeight: 600 }}>{props.value}</p>
    </div>
  );
}




