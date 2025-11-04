# Railway Configuration Setup

## Environment Variables to Set

Set these in Railway Dashboard → Service → Variables:

```
NODE_ENV=production
SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1
PACKAGE_MANAGER=pnpm
```

## Railway Service Settings

Based on your working configuration:

### Source
- **Source Repo:** `stevenshelley58-afk/Dashboard`
- **Root Directory:** (leave empty for root)
- **Branch:** `main`
- **Wait for CI:** (optional)

### Build
- **Builder:** `Railpack`
- **Build Command:** `pnpm -F @dashboard/worker build`
- **Watch Paths:** `/apps/worker/**`

### Deploy
- **Start Command:** `pnpm -F @dashboard/worker start`
- **Restart Policy:** `On Failure`
- **Max Restart Retries:** `10`

## Quick Setup Commands

### Via Railway Dashboard
1. Go to Railway → Your Service → Variables
2. Add each variable listed above
3. Go to Settings → Build
4. Set Builder to "Railpack"
5. Set Build Command to: `pnpm -F @dashboard/worker build`
6. Set Start Command to: `pnpm -F @dashboard/worker start`

### Via Railway CLI
```powershell
railway link
railway variables --set "NODE_ENV=production"
railway variables --set "SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1"
railway variables --set "PACKAGE_MANAGER=pnpm"
```

