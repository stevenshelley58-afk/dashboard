# Setup Guide

## Prerequisites

Install these tools:
- Node.js 18+ and npm
- Git
- Supabase CLI: `npm install -g supabase`
- Vercel CLI: `npm install -g vercel` (optional)
- Railway CLI: `npm install -g @railway/cli` (optional)

## Initial Setup

1. **Clone and install dependencies:**
```bash
npm install
cd packages/config && npm install && cd ../..
cd apps/worker && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

2. **Set up Supabase:**
```bash
cd supabase
supabase start  # Start local Supabase
supabase link  # Link to your project (when ready)
```

3. **Run migrations:**
```bash
supabase db push
```

4. **Environment variables:**
   - Copy `.env.example` to `.env.local` (or create your own)
   - Fill in all required values (see spec for details)

## Development

### Local Development

1. **Start Supabase:**
```bash
cd supabase
supabase start
```

2. **Start worker:**
```bash
cd apps/worker
npm run dev
```

3. **Start frontend:**
```bash
cd apps/web
npm run dev
```

### Testing

1. **Verify tools:**
```bash
npm run verify-tools
```

2. **Run agent system:**
```bash
npm run dev
```

## Deployment

### Supabase

1. **Link project:**
```bash
supabase link --project-ref <your-project-ref>
```

2. **Push migrations:**
```bash
supabase db push
```

3. **Deploy Edge Functions:**
```bash
supabase functions deploy sync
```

### Railway (Worker)

1. **Connect GitHub repo:**
   - Go to https://railway.app
   - Create new project → Deploy from GitHub repo
   - Select your repository
   - Railway will auto-detect the monorepo structure

2. **Set environment variables in Railway dashboard:**
   
   **Required:**
   ```
   SUPABASE_DB_URL=postgresql://postgres.<project-ref>.supabase.co:5432/postgres?sslmode=require
   ```
   
   **Optional (for ETL functionality):**
   ```
   META_ACCESS_TOKEN=<your-meta-token>
   META_AD_ACCOUNT_ID=act_<account-id>
   GA4_CREDENTIALS_JSON='<service-account-json>'
   GA4_PROPERTY_ID=<property-id>
   KLAVIYO_API_KEY=<your-key>
   ```

3. **Deploy automatically on push to `main`**
   - Railway uses `pnpm` for this project (auto-detected via `pnpm-workspace.yaml`)
   - Build command: `pnpm install && pnpm --filter @dashboard/config build && pnpm --filter @dashboard/worker build`
   - Start command: `cd apps/worker && pnpm start`

### Vercel (Frontend)

1. Connect GitHub repo to Vercel
2. Set up Vercel ↔ Supabase integration
3. Deploy automatically on push to `main`

## Environment Variables

See `specs/Spec V1` for complete environment variable contract.

Key variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (worker only)
- `SUPABASE_DB_URL` - Direct database connection (worker only)
- Platform API keys (Shopify, Meta, GA4, Klaviyo)

## Git Workflow

- `main` → production deployments
- `develop` → preview/staging
- `feature/*` → feature branches

Migrations are NOT auto-run. Apply manually:
```bash
supabase link
supabase db push
```

## Troubleshooting

### Worker won't connect to database
- Check `SUPABASE_DB_URL` is set correctly
- Ensure TLS is enabled (`?sslmode=require`)
- Verify connection pooler settings

### Frontend can't access Supabase
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify Vercel ↔ Supabase integration is set up
- Check API settings in Supabase dashboard (expose reporting schema)

### Edge Function errors
- Verify JWT verification is working
- Check function logs in Supabase dashboard
- Ensure shop access validation logic is implemented

### Railway deployment failures

**Build errors:**
- Ensure `pnpm-workspace.yaml` exists in root directory
- Verify `packages/config` has `composite: true` in tsconfig.json
- Check that all workspace dependencies are properly installed
- View build logs: `railway logs` or Railway dashboard

**Runtime errors:**
- Verify `SUPABASE_DB_URL` is set correctly with TLS (`?sslmode=require`)
- Check that worker can connect to database (view logs in Railway dashboard)
- Ensure `dist/index.js` exists after build (check build output)
- Verify all required environment variables are set

**Monorepo issues:**
- Railway uses pnpm for this project (detected via `pnpm-workspace.yaml`)
- Build order: root install → config build → worker build
- Ensure workspace packages are built before dependent packages

