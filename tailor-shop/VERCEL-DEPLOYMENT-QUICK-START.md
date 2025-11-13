# Vercel Deployment Quick Start

This is a quick reference guide for deploying your multi-branch tailor shop application to Vercel with **zero data loss**.

## TL;DR - Quick Steps

```bash
# 1. Backup production database (in Supabase dashboard)

# 2. Run pre-migration on production database
# (See options below)

# 3. Push code to GitHub (already done)
git push origin main

# 4. Vercel will auto-deploy
# (Or manually: vercel --prod)

# 5. Test with admin@smarttrendz.com / admin123
```

## Detailed Steps

### Step 1: Backup Database

**In Supabase Dashboard:**
1. Go to your project → Database → Backups
2. Click "Create backup"
3. Wait for completion

### Step 2: Run Pre-Migration Script

**Choose ONE of these options:**

#### Option A: Direct SQL in Supabase (Easiest)

1. Open Supabase SQL Editor
2. Run this script:

```sql
-- 1. Create branches
INSERT INTO "Branch" (id, name, location, active, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Accra', 'Accra, Greater Accra Region', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Koforidua', 'Koforidua, Eastern Region', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 2. Get Accra branch ID
SELECT id, name FROM "Branch" WHERE name = 'Accra';
-- Copy the Accra ID and replace [ACCRA_ID] below

-- 3. Update customers
UPDATE "Customer"
SET
  "branchId" = '[ACCRA_ID]',
  "createdBy" = 'MIGRATION',
  "updatedBy" = 'MIGRATION'
WHERE "branchId" IS NULL;

-- 4. Update orders
UPDATE "Order" o
SET
  "branchId" = c."branchId",
  "createdBy" = 'MIGRATION',
  "updatedBy" = 'MIGRATION'
FROM "Customer" c
WHERE o."customerId" = c.id
AND o."branchId" IS NULL;

-- 5. Update payments
UPDATE "Payment"
SET "createdBy" = 'MIGRATION'
WHERE "createdBy" IS NULL;

-- 6. Update staff users
UPDATE "User"
SET "branchId" = '[ACCRA_ID]'
WHERE role IN ('STAFF', 'VIEWER')
AND "branchId" IS NULL;

-- 7. Verify migration
SELECT
  b.name as branch_name,
  COUNT(DISTINCT c.id) as customers,
  COUNT(DISTINCT o.id) as orders,
  COUNT(DISTINCT u.id) as users
FROM "Branch" b
LEFT JOIN "Customer" c ON c."branchId" = b.id
LEFT JOIN "Order" o ON o."branchId" = b.id
LEFT JOIN "User" u ON u."branchId" = b.id
GROUP BY b.name
ORDER BY b.name;
```

#### Option B: Use Node.js Script Locally

```bash
# Set production database URL temporarily
export DATABASE_URL="your-production-supabase-url"
export DIRECT_URL="your-production-direct-url"

# Run pre-migration
yarn prisma:pre-migrate

# Unset environment variables
unset DATABASE_URL
unset DIRECT_URL
```

#### Option C: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link to your project
cd /path/to/tailor-shop
vercel link

# Run pre-migration
vercel run yarn prisma:pre-migrate --prod
```

### Step 3: Verify Migration

In Supabase SQL Editor, run:

```sql
-- Check that all customers have branchId
SELECT
  COUNT(*) as total_customers,
  COUNT("branchId") as customers_with_branch
FROM "Customer";
-- These numbers should match

-- Check that all orders have branchId
SELECT
  COUNT(*) as total_orders,
  COUNT("branchId") as orders_with_branch
FROM "Order";
-- These numbers should match

-- Check branches
SELECT * FROM "Branch";
-- Should show Accra and Koforidua
```

### Step 4: Deploy to Vercel

#### If Auto-Deploy is Enabled (Default):
- Code is already pushed to GitHub
- Vercel will automatically detect and deploy
- Monitor: https://vercel.com/dashboard

#### If Manual Deploy:
```bash
vercel --prod
```

### Step 5: Verify Deployment

1. **Visit your app**: `https://your-app.vercel.app`

2. **Login as admin**:
   - Email: `admin@smarttrendz.com`
   - Password: `admin123`

3. **Check the data**:
   - View customers (should see all existing customers)
   - View orders (should see all existing orders)
   - Create a test customer
   - Create a test order

4. **Test activity logging**:
   ```bash
   curl https://your-app.vercel.app/api/activity-logs
   ```

## Environment Variables in Vercel

Ensure these are set in Vercel → Your Project → Settings → Environment Variables:

```
DATABASE_URL=postgresql://...supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...supabase.co:5432/postgres
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Troubleshooting

### Issue: "branchId is required" Error

**Solution**: Re-run the pre-migration script

### Issue: Can't login after deployment

**Solution**: Clear browser cookies and try again, or use incognito mode

### Issue: Can't see any data

**Solution**: Check that the user has proper branch assignment:
```sql
SELECT id, email, role, "branchId" FROM "User";
```

### Issue: Deployment failed

**Solution**: Check Vercel logs:
1. Go to Vercel dashboard
2. Click on failed deployment
3. View "Build Logs" and "Function Logs"

## Rollback Plan

If deployment fails:

1. **Rollback Code**: In Vercel dashboard → Deployments → Previous deployment → "Promote to Production"

2. **Rollback Database**: In Supabase dashboard → Database → Backups → Restore

## Post-Deployment Tasks

### 1. Create Branch-Specific Users

Login as admin and create staff users for each branch:

**Via API**:
```bash
curl -X POST https://your-app.vercel.app/api/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "email": "accra@smarttrendz.com",
    "name": "Accra Staff",
    "password": "staff123",
    "role": "STAFF",
    "branchId": "ACCRA_BRANCH_ID"
  }'
```

### 2. Reassign Customers to Correct Branches

If customers were all assigned to Accra by default, reassign them:

**In Supabase SQL Editor**:
```sql
-- Get Koforidua branch ID
SELECT id FROM "Branch" WHERE name = 'Koforidua';

-- Update specific customers
UPDATE "Customer"
SET "branchId" = 'KOFORIDUA_BRANCH_ID'
WHERE "fullName" IN ('Customer 1', 'Customer 2', ...);

-- Or update by phone number
UPDATE "Customer"
SET "branchId" = 'KOFORIDUA_BRANCH_ID'
WHERE "phoneNumber" IN ('0241234567', '0201234567', ...);
```

### 3. Update Related Orders

When you reassign customers, also update their orders:

```sql
UPDATE "Order" o
SET "branchId" = c."branchId"
FROM "Customer" c
WHERE o."customerId" = c.id;
```

## Monitoring

### Check Application Health

```bash
# Test API endpoints
curl https://your-app.vercel.app/api/branches
curl https://your-app.vercel.app/api/users
curl https://your-app.vercel.app/api/activity-logs
```

### Monitor Logs

1. **Vercel Logs**: Vercel Dashboard → Your Project → Logs
2. **Supabase Logs**: Supabase Dashboard → Logs

## Need Help?

Refer to the full guide: [PRODUCTION-MIGRATION-GUIDE.md](./PRODUCTION-MIGRATION-GUIDE.md)

## Summary Checklist

- [ ] Backup production database in Supabase
- [ ] Run pre-migration script (Option A, B, or C)
- [ ] Verify migration with SQL queries
- [ ] Ensure environment variables are set in Vercel
- [ ] Deploy to Vercel (auto or manual)
- [ ] Test admin login
- [ ] Create test customer/order
- [ ] Check activity logs
- [ ] Create branch-specific staff users
- [ ] Reassign customers to correct branches if needed
- [ ] Update orders to match customer branches
- [ ] Monitor logs for errors

---

**Ready to deploy?** Start with Step 1: Backup your database!
