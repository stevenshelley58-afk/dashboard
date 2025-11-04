# Set Railway Environment Variables
# Run this script after linking to Railway project

Write-Host "Setting Railway environment variables..." -ForegroundColor Green

# Link to Railway project (if not already linked)
Write-Host "`n1. Linking to Railway project..." -ForegroundColor Yellow
Write-Host "   Select 'refreshing-strength' when prompted" -ForegroundColor Gray
railway link

# Set required environment variables
Write-Host "`n2. Setting environment variables..." -ForegroundColor Yellow

railway variables --set "NODE_ENV=production"

railway variables --set "SUPABASE_DB_URL=postgresql://postgres:J7Tg4LkQiTbz%21cS@db.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1"

railway variables --set "PACKAGE_MANAGER=pnpm"

# Verify variables
Write-Host "`n3. Verifying variables..." -ForegroundColor Yellow
railway variables

Write-Host "`n✅ Environment variables set! Railway will automatically redeploy." -ForegroundColor Green
Write-Host "`nConnection string details:" -ForegroundColor Cyan
Write-Host "  - Host: db.gywjhlqmqucjkneucjbp.supabase.co (direct connection)" -ForegroundColor Gray
Write-Host "  - SSL: enabled (sslmode=require)" -ForegroundColor Gray
Write-Host "  - Application name: worker-listener" -ForegroundColor Gray
Write-Host "  - Keepalives: enabled" -ForegroundColor Gray

