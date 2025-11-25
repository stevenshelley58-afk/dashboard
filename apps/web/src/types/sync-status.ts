export type IntegrationType = "shopify" | "meta" | string;

export interface SyncStatusIntegration {
  integration_id: string;
  type: IntegrationType;
  status: string;
  display_name: string | null;
  identifier: string | null;
  last_successful_sync: string | null;
  last_attempted_sync: string | null;
  data_fresh_to: string | null;
  manual_job_types: string[];
}

export interface SyncStatusResponse {
  integrations: SyncStatusIntegration[];
}




