# Dashboard Deployment Guide

## ✅ Current Status

### Completed:
- ✅ Database schema and migrations ready
- ✅ Secure JWT and Shopify secrets generated
- ✅ Worker environment configured
- ✅ Dependencies installed
- ✅ Database migrated with seed data
- ✅ Local development tested and working
- ✅ Vercel deployment configuration created
- ✅ Railway deployment configuration created
- ✅ Environment variable templates documented

### Remaining for Production:
- 🔲 Meta/Facebook API configuration
- 🔲 Production domain configuration
- 🔲 Deploy to Vercel
- 🔲 Deploy to Railway

## 🚀 Production Deployment Steps

### 1. Vercel Deployment (Web App)

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to Vercel**:
   ```bash
   cd C:\Dashboard
   vercel --prod
   ```

4. **Set Environment Variables in Vercel Dashboard**:
   Go to your project settings on vercel.com and add these environment variables:
   
   ```
   DATABASE_URL = postgresql://postgres:[PASSWORD]@db.cljpiaygjtspppsvntnu.supabase.co:6543/postgres?pgbouncer=true
   JWT_SECRET = [GENERATE-WITH: openssl rand -hex 32]
   SHOPIFY_API_KEY = b2e5f947f63da4b978ff0cea2765d91d
   SHOPIFY_API_SECRET = [YOUR-SHOPIFY-API-SECRET]
   SHOPIFY_STATE_SECRET = [GENERATE-WITH: openssl rand -hex 32]
   SHOPIFY_APP_URL = https://[YOUR-VERCEL-DOMAIN].vercel.app
   LOCAL_DEV_ACCOUNT_ID = 079ed5c0-4dfd-4feb-aa91-0c4017a7be2f
   META_JOBS_ENABLED = true
   ```

   **Important**: Use port 6543 (transaction pooler) for Vercel, not 5432!

### 2. Railway Deployment (Worker)

1. **Install Railway CLI** (if not installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Create new Railway project**:
   ```bash
   cd C:\Dashboard
   railway init
   ```

4. **Set Environment Variables in Railway**:
   ```bash
   railway variables set DATABASE_URL="postgresql://postgres:[PASSWORD]@db.cljpiaygjtspppsvntnu.supabase.co:5432/postgres"
   railway variables set SHOPIFY_API_KEY="b2e5f947f63da4b978ff0cea2765d91d"
   railway variables set SHOPIFY_API_SECRET="[YOUR-SHOPIFY-API-SECRET]"
   railway variables set SHOPIFY_API_VERSION="2024-10"
   railway variables set JOB_POLL_INTERVAL_MS="5000"
   ```

   **Important**: Use port 5432 (direct connection) for Railway, not 6543!

5. **Deploy to Railway**:
   ```bash
   railway up
   ```

### 3. Meta/Facebook Configuration (Optional)

To enable Meta/Facebook integration:

1. **Create Meta App**:
   - Go to https://developers.facebook.com/
   - Create new app
   - Add Marketing API product

2. **Get Credentials**:
   - App ID from app dashboard
   - App Secret from Settings > Basic

3. **Add to Environment Variables**:
   ```
   META_APP_ID = your-app-id
   META_APP_SECRET = your-app-secret
   META_API_VERSION = v18.0
   ```

### 4. Domain Configuration

1. **Update Shopify App URL**:
   - Update SHOPIFY_APP_URL in Vercel to your production domain
   - Update shopify.app.toml with production URLs

2. **Configure Custom Domain** (optional):
   - Add custom domain in Vercel dashboard
   - Update DNS records

## 🔍 Verification Steps

### Test Web App:
```bash
curl https://[YOUR-VERCEL-DOMAIN].vercel.app/api/health-lite
```
Expected: `{"db":"ok","checkedAt":"..."}`

### Check Worker Logs:
```bash
railway logs
```

### Test Shopify Install:
Visit: `https://[YOUR-VERCEL-DOMAIN].vercel.app/api/shopify/install?shop=[SHOP].myshopify.com`

## 🐛 Troubleshooting

### Database Connection Issues:
- Vercel: Must use port 6543 (transaction pooler)
- Railway: Must use port 5432 (direct connection)
- Check Supabase dashboard for connection limits

### Shopify OAuth Issues:
- Verify SHOPIFY_APP_URL matches your Vercel domain
- Check app settings in Shopify Partner dashboard
- Ensure redirect URLs are whitelisted

### Worker Not Processing Jobs:
- Check Railway logs: `railway logs`
- Verify DATABASE_URL is correct (port 5432)
- Check sync_runs table for job status

## 📊 Current Database State

- Account: `079ed5c0-4dfd-4feb-aa91-0c4017a7be2f` (Internal Agency)
- User: `founder@example.com`
- All tables created and ready
- Seed data applied

## 🔐 Security Notes

**IMPORTANT**: After deployment works:
1. Rotate all secrets as mentioned
2. Remove LOCAL_DEV_ACCOUNT_ID from production
3. Enable proper authentication
4. Set up monitoring and alerts

## 📝 Environment Files Reference

- `apps/web/env.example` - Web app environment template
- `apps/worker/env.example` - Worker environment template
- `vercel.json` - Vercel deployment configuration
- `railway.toml` - Railway deployment configuration

## Next Steps

1. Deploy to Vercel (follow steps above)
2. Deploy to Railway (follow steps above)
3. Configure Meta API (if needed)
4. Test end-to-end flow
5. Set up monitoring
