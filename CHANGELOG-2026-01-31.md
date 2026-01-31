# Dashboard Updates - January 31, 2026

## Summary

Tonight's work focused on making the BHM Dashboard a complete business hub. Here's what was accomplished:

## 1. Railway Build Fix ✅

**Problem:** The Railway worker build was failing because `tsc` wasn't found during the build phase.

**Fix:**
- Changed `railway.toml` to run builds from the monorepo root using `npm run build:worker`
- Moved `typescript` from devDependencies to dependencies in worker's package.json
- Changed build script to use `npx tsc` for better path resolution

## 2. Better UI Merged ✅

The `claude/clarify-chat-navigation` branch features have been merged into main:
- ShopifyQL integration for sessions, traffic sources, and conversion funnel
- Enhanced Shopify Analytics dashboard
- Top Products analytics from order line items

## 3. Planner (Todo List) Added ✅

New `/planner` page with:
- Task creation with title and priority (low/medium/high/urgent)
- Status cycling: Todo → In Progress → Done
- Delete/archive functionality
- Filter by status
- Clean, ADHD-friendly UI with minimal clutter
- Persists to Supabase

**Migration applied:** `db/migrations/006_tasks.sql` (already run on Supabase)

## 4. Chat with Claude Added ✅

New `/chat` page with:
- Direct connection to OpenClaw API
- Settings panel for API key configuration
- Chat history stored in browser localStorage
- Simple, clean interface
- System prompt identifies context as "BHM Dashboard"

## Files Changed

- `apps/web/src/app/(dashboard)/chat/` - New chat feature
- `apps/web/src/app/(dashboard)/planner/` - New planner feature
- `apps/web/src/app/api/tasks/route.ts` - Tasks API
- `apps/web/src/components/dashboard/Sidebar.tsx` - Added nav items
- `apps/worker/` - Build fix + shopify_sessions job handler
- `railway.toml` - Fixed build commands
- `db/migrations/006_tasks.sql` - Tasks table

## Deployment Status

### Supabase ✅
- Migration 006_tasks.sql has been applied
- Database is ready

### Vercel (Frontend) 🔄
- Build verified locally ✅
- Needs git push to trigger auto-deploy

### Railway (Worker) 🔄
- Build fix applied ✅
- Needs git push to trigger rebuild

## To Complete Deployment

Steve needs to push to GitHub:
```bash
cd /root/.openclaw/workspace/dashboard-project
git push origin main
```

Or I can generate a patch file if there are auth issues.

## Next Steps (Future)

1. Add floating chat widget accessible from any page
2. Add task due date calendar view
3. Add quick actions for common business tasks
4. Consider adding task categories/tags
