/** Shared config types - copied from packages/config for Vercel deployment */
// Since Vercel can't use workspace: dependencies, we define types here

export enum RunStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export enum JobType {
  HISTORICAL = 'HISTORICAL',
  INCREMENTAL = 'INCREMENTAL',
}

export enum Platform {
  SHOPIFY = 'SHOPIFY',
  META = 'META',
  GA4 = 'GA4',
  KLAVIYO = 'KLAVIYO',
}

