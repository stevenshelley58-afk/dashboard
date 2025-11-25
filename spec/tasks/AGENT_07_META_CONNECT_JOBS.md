## Agent 07 – Meta Connect + Jobs

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_03_SCHEMA_TENANCY_INTEGRATIONS.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/PHASE0_05_JOBS_PIPELINE.md` (Meta sections)
- `spec/MVP Build Plan.md` (Stage 4)

---

### Goal

Connect a Meta ad account and implement `meta_7d_fill` + `meta_fresh` jobs, writing Meta data into warehouse + daily aggregates.

---

### Work

- **Meta connect flow (web)**
  - Implement OAuth or secure token input.
  - On success:
    - Create `ad_accounts` and `integrations` (`type='meta'`).
    - Store token + ad account id in `integration_secrets`.
    - Enforce `accounts.currency` rule (block mismatches).

- **`meta_7d_fill` job**
  - For last 7 days:
    - Call Ads Insights:
      - `level='ad'`.
      - Filter `ad.effective_status IN ('ACTIVE', 'PAUSED')`.
    - Upsert into `meta_insights_raw`.
    - Build `fact_meta_daily`.
  - Build `daily_meta_metrics` + update `daily_summary` for those days.
  - Initialise Meta cursor if spec requires.

- **`meta_fresh` job**
  - For each ad account:
    - Window `[today - attribution_window_days + 1 … yesterday]`.
    - Re-fetch insights for each day in window.
    - Upsert raw + `fact_meta_daily`.
    - Rebuild `daily_meta_metrics` + `daily_summary` for those dates.
  - Handle 429 / rate limiting with exponential backoff.
  - Log `sync_runs` with rate_limited flags if applicable.

---

### Out of scope

- Meta UI page.
- Home blended view.

---

### Acceptance

- For a dev Meta account:
  - `meta_insights_raw`, `fact_meta_daily`, `daily_meta_metrics`, `daily_summary` are populated for last 7 days.
  - Spend and purchase_value roughly match Ads Manager.


