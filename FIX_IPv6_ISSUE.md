# Fix Supabase IPv6 Connection Issue

## Problem
Supabase has moved to IPv6-only for direct database connections. Railway containers don't have IPv6 connectivity, causing `ENETUNREACH` errors.

## Solution: Use Supabase Connection Pooler (IPv4-Compatible)

### Step 1: Get Your Pooler Connection String

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/gywjhlqmqucjkneucjbp
2. Navigate to **Settings** → **Database**
3. Scroll to **Connection String** section
4. Select **Connection pooling** (NOT "Direct connection")
5. Choose **Transaction mode** (recommended for short-lived connections like Railway workers)
6. Copy the connection string - it should look like:
   ```
   postgresql://postgres.gywjhlqmqucjkneucjbp:[YOUR-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
   ```

### Step 2: Update Railway Environment Variable

In Railway dashboard for your worker service:

1. Go to **Variables**
2. Update `SUPABASE_DB_URL` to the **pooler connection string** (from Step 1)
3. Make sure to:
   - URL-encode the password (replace `!` with `%21`, etc.)
   - Add `?sslmode=require` at the end
   - Optionally add `&application_name=worker-listener&keepalives=1`

**Example:**
```
SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&application_name=worker-listener&keepalives=1
```

### Step 3: Redeploy

Railway will automatically redeploy with the new environment variable. The pooler supports IPv4 and your worker will connect successfully.

---

## Alternative: Enable IPv4 Add-On (Costs Extra)

If you need direct database connections:

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gywjhlqmqucjkneucjbp
2. Navigate to **Settings** → **Add-ons**
3. Enable **IPv4 Address** add-on (this costs additional money per month)
4. Use the IPv4 connection string provided

---

## Why This Works

- **Direct connection** (`db.gywjhlqmqucjkneucjbp.supabase.co`) = IPv6 only
- **Connection pooler** (`aws-1-ap-southeast-2.pooler.supabase.com`) = Supports both IPv4 and IPv6
- Railway containers = IPv4 only

Using the pooler solves the connectivity issue without code changes.

