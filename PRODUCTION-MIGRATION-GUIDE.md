# Production Migration Guide: Multi-Branch System

This guide explains how to safely migrate your production database from the old schema to the new multi-branch system **without losing any data**.

## Overview

The migration involves two phases:
1. **Phase 1**: Run a migration script that assigns existing data to branches (BEFORE deploying new code)
2. **Phase 2**: Deploy the new application code with updated schema

## Prerequisites

- Access to your production database
- Access to your Vercel deployment settings
- Backup of your production database (recommended)

---

## Phase 1: Pre-Deployment Data Migration

### Step 1: Backup Your Production Database

**CRITICAL**: Always backup before making schema changes.

Using Supabase:
1. Go to your Supabase project dashboard
2. Navigate to Database → Backups
3. Create a manual backup
4. Wait for backup to complete before proceeding

### Step 2: Understand the Migration

The migration script will:
- ✅ Create two branches: Accra and Koforidua
- ✅ Assign all existing customers to Accra branch (default)
- ✅ Assign all existing orders to match their customer's branch
- ✅ Add creator tracking to all payments
- ✅ Create/update admin user with full access
- ✅ Ensure all staff users have branch assignments

**Important**: This script must be run BEFORE deploying the new schema, while the old schema is still active.

### Step 3: Create Pre-Migration Script

Since your production database still has the OLD schema (where `branchId` is nullable), create this script:

Create file: `prisma/production-pre-migration.ts`

```typescript
/**
 * PRODUCTION PRE-MIGRATION SCRIPT
 *
 * Run this BEFORE deploying the new schema to production.
 * This prepares existing data for the multi-branch system.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting PRODUCTION pre-migration...\n');

  try {
    // Check if schema is already migrated
    const sampleCustomer = await prisma.customer.findFirst();
    if (sampleCustomer && sampleCustomer.branchId) {
      console.log('⚠️  Database appears to already be migrated.');
      console.log('   If you need to re-run migration, please verify schema first.\n');
      return;
    }

    // Step 1: Create branches
    console.log('📍 Creating branches...');

    const accraBranch = await prisma.$executeRaw`
      INSERT INTO "Branch" (id, name, location, active, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'Accra', 'Accra, Greater Accra Region', true, NOW(), NOW())
      ON CONFLICT (name) DO NOTHING
      RETURNING id;
    `;

    const koforidua = await prisma.$executeRaw`
      INSERT INTO "Branch" (id, name, location, active, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'Koforidua', 'Koforidua, Eastern Region', true, NOW(), NOW())
      ON CONFLICT (name) DO NOTHING
      RETURNING id;
    `;

    // Get branch IDs
    const accra = await prisma.$queryRaw`
      SELECT id FROM "Branch" WHERE name = 'Accra' LIMIT 1;
    `;
    const accraBranchId = accra[0]?.id;

    console.log(`✅ Branches created. Accra ID: ${accraBranchId}\n`);

    // Step 2: Update customers - assign all to Accra
    console.log('👥 Migrating customers...');
    const customerCount = await prisma.$executeRaw`
      UPDATE "Customer"
      SET
        "branchId" = ${accraBranchId},
        "createdBy" = 'MIGRATION',
        "updatedBy" = 'MIGRATION'
      WHERE "branchId" IS NULL;
    `;
    console.log(`✅ Updated ${customerCount} customers\n`);

    // Step 3: Update orders - assign to customer's branch
    console.log('📦 Migrating orders...');
    const orderCount = await prisma.$executeRaw`
      UPDATE "Order" o
      SET
        "branchId" = c."branchId",
        "createdBy" = 'MIGRATION',
        "updatedBy" = 'MIGRATION'
      FROM "Customer" c
      WHERE o."customerId" = c.id
      AND o."branchId" IS NULL;
    `;
    console.log(`✅ Updated ${orderCount} orders\n`);

    // Step 4: Update payments
    console.log('💰 Migrating payments...');
    const paymentCount = await prisma.$executeRaw`
      UPDATE "Payment"
      SET "createdBy" = 'MIGRATION'
      WHERE "createdBy" IS NULL;
    `;
    console.log(`✅ Updated ${paymentCount} payments\n`);

    // Step 5: Create/update admin user
    console.log('👨‍💼 Setting up admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await prisma.$executeRaw`
      INSERT INTO "User" (id, email, name, password, role, "branchId", active, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        'admin@smarttrendz.com',
        'Admin User',
        ${hashedPassword},
        'ADMIN',
        NULL,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (email)
      DO UPDATE SET
        role = 'ADMIN',
        "branchId" = NULL,
        active = true;
    `;
    console.log('✅ Admin user ready\n');

    // Step 6: Update staff users to have branch assignments
    console.log('👷 Migrating staff users...');
    const staffCount = await prisma.$executeRaw`
      UPDATE "User"
      SET "branchId" = ${accraBranchId}
      WHERE role IN ('STAFF', 'VIEWER')
      AND "branchId" IS NULL;
    `;
    console.log(`✅ Updated ${staffCount} staff users\n`);

    console.log('✅ Pre-migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('1. Verify the migration in your database');
    console.log('2. Deploy the new application code');
    console.log('3. Test with admin@smarttrendz.com / admin123\n');

  } catch (error) {
    console.error('\n❌ Pre-migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 4: Run Pre-Migration on Production

**Option A: Using Vercel CLI** (Recommended)

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
cd /path/to/tailor-shop
vercel link

# Set production environment variable temporarily
vercel env add DATABASE_URL production

# Run the migration
vercel run prisma:pre-migrate --prod
```

**Option B: Direct Database Access**

If you have direct access to your production database:

```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="your-production-database-url"
export DIRECT_URL="your-production-direct-url"

# Run migration
yarn prisma:pre-migrate
```

**Option C: Manual SQL Execution**

Execute the following SQL directly in your Supabase SQL editor:

```sql
-- 1. Create branches
INSERT INTO "Branch" (id, name, location, active, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Accra', 'Accra, Greater Accra Region', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Koforidua', 'Koforidua, Eastern Region', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 2. Get Accra branch ID (save this for next steps)
SELECT id FROM "Branch" WHERE name = 'Accra';
-- Save the ID, replace [ACCRA_BRANCH_ID] below with actual ID

-- 3. Update customers
UPDATE "Customer"
SET
  "branchId" = '[ACCRA_BRANCH_ID]',
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
SET "branchId" = '[ACCRA_BRANCH_ID]'
WHERE role IN ('STAFF', 'VIEWER')
AND "branchId" IS NULL;

-- 7. Create admin user (change password hash as needed)
INSERT INTO "User" (id, email, name, password, role, "branchId", active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@smarttrendz.com',
  'Admin User',
  '$2a$10$YourHashedPasswordHere', -- Generate using bcrypt
  'ADMIN',
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email)
DO UPDATE SET
  role = 'ADMIN',
  "branchId" = NULL,
  active = true;
```

---

## Phase 2: Deploy New Application

### Step 1: Verify Pre-Migration

Before deploying, verify in Supabase:

```sql
-- Check branches were created
SELECT * FROM "Branch";

-- Check all customers have branchId
SELECT COUNT(*) as total,
       COUNT("branchId") as with_branch
FROM "Customer";
-- total should equal with_branch

-- Check all orders have branchId
SELECT COUNT(*) as total,
       COUNT("branchId") as with_branch
FROM "Order";
-- total should equal with_branch
```

### Step 2: Deploy to Vercel

If you have **automatic deployments enabled**:
1. Push your code to GitHub (already done)
2. Vercel will automatically deploy
3. Monitor the deployment in Vercel dashboard

If **manual deployment**:
```bash
vercel --prod
```

### Step 3: Verify Environment Variables

In Vercel dashboard, ensure these are set:
- ✅ `DATABASE_URL` (Supabase pooling URL)
- ✅ `DIRECT_URL` (Supabase direct URL)
- ✅ `NEXTAUTH_SECRET`
- ✅ `NEXTAUTH_URL` (your production URL)
- ✅ Any SMS/notification API keys

### Step 4: Test the Deployment

1. **Test Admin Login**:
   - URL: `https://your-app.vercel.app/login`
   - Email: `admin@smarttrendz.com`
   - Password: `admin123`
   - Should see all branches' data

2. **Test Staff Login** (if you have staff users):
   - Should only see their assigned branch data

3. **Create Test Records**:
   - Create a new customer
   - Create a new order
   - Record a payment
   - Verify activity logs are being created

### Step 5: Verify Activity Logging

Test API endpoints:

```bash
# Get all activity logs (admin only)
curl https://your-app.vercel.app/api/activity-logs \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Get branch summary
curl "https://your-app.vercel.app/api/activity-logs?summary=branch&branchId=BRANCH_ID" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

---

## Rollback Plan

If something goes wrong:

### Immediate Rollback

1. In Vercel dashboard, go to your project
2. Click "Deployments"
3. Find the previous (working) deployment
4. Click "..." menu → "Promote to Production"

### Database Rollback

If you need to rollback the database:

1. Go to Supabase dashboard
2. Database → Backups
3. Restore from the backup you created in Phase 1, Step 1

---

## Post-Migration Tasks

After successful deployment:

### 1. Create Branch-Specific Staff Users

```bash
# Using API or Prisma Studio
POST /api/users
{
  "email": "accra@smarttrendz.com",
  "name": "Accra Staff",
  "password": "staff123",
  "role": "STAFF",
  "branchId": "[ACCRA_BRANCH_ID]"
}

POST /api/users
{
  "email": "koforidua@smarttrendz.com",
  "name": "Koforidua Staff",
  "password": "staff123",
  "role": "STAFF",
  "branchId": "[KOFORIDUA_BRANCH_ID]"
}
```

### 2. Assign Existing Customers to Correct Branches

Review and reassign customers to their actual branches:

```sql
-- Update specific customers to Koforidua
UPDATE "Customer"
SET "branchId" = (SELECT id FROM "Branch" WHERE name = 'Koforidua')
WHERE "fullName" IN ('Customer Name 1', 'Customer Name 2', ...);
```

### 3. Update Existing APIs

Next steps for full implementation (not required for deployment):
- Update Customers API with branch filtering
- Update Orders API with branch filtering
- Update Payments API with branch verification
- Create Admin UI pages
- Add branch selector component

---

## Monitoring

### Check Deployment Health

1. **Vercel Dashboard**: Monitor for errors
2. **Supabase Logs**: Check for database errors
3. **Application Logs**: Monitor API responses

### Key Metrics to Watch

- Login success rate
- API error rates
- Database connection pool usage
- Activity log creation rate

---

## Troubleshooting

### Issue: "branchId is required" errors

**Cause**: Old data still exists without branch assignment

**Fix**: Re-run the pre-migration script or manually assign branches

### Issue: "Unauthorized" or session errors

**Cause**: NextAuth session structure changed

**Fix**: Users need to log out and log back in to refresh their session

### Issue: Can't see any data after login

**Cause**: User doesn't have proper branch assignment

**Fix**: Update user's branchId in database:
```sql
UPDATE "User"
SET "branchId" = (SELECT id FROM "Branch" WHERE name = 'Accra')
WHERE email = 'user@example.com';
```

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase database logs
3. Review this guide's troubleshooting section
4. Rollback if necessary and investigate

---

## Summary Checklist

### Pre-Deployment
- [ ] Backup production database
- [ ] Run pre-migration script
- [ ] Verify all records have branchId
- [ ] Verify admin user exists

### Deployment
- [ ] Push code to GitHub
- [ ] Verify environment variables in Vercel
- [ ] Deploy to Vercel (automatic or manual)
- [ ] Monitor deployment for errors

### Post-Deployment
- [ ] Test admin login
- [ ] Test staff login
- [ ] Create test records
- [ ] Verify activity logging
- [ ] Create branch-specific users
- [ ] Reassign customers to correct branches

### Verification
- [ ] All existing data is visible
- [ ] New records can be created
- [ ] Activity logs are working
- [ ] Branch filtering works correctly
- [ ] No errors in logs
