# Multi-Tenancy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Tenant` model so each boutique's data is completely isolated from every other boutique's, using session-based JWT routing with no URL changes.

**Architecture:** A new `Tenant` table is the top-level anchor. `User` and `Branch` get a `tenantId` foreign key; `Customer → Order → Payment` inherit isolation transitively via `branchId`. The logged-in user's `tenantId` is stored in the JWT at login and used to scope every Prisma query that currently returns unfiltered data for ADMINs.

**Tech Stack:** Next.js 14 App Router, Prisma 5, PostgreSQL (Supabase), NextAuth v4 JWT sessions, TypeScript strict mode, `bcryptjs`

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Tenant` model, `TenantStatus` enum, `SUPER_ADMIN` to UserRole-equivalent, `tenantId` on `User`/`Branch`/`BusinessProfile` |
| `prisma/seed.ts` | Full rewrite — create Tenant first, then Branch, then Users with `tenantId` |
| `src/types/next-auth.d.ts` | Add `tenantId: string \| null` to `User`, `Session.user`, `JWT` |
| `src/lib/auth.ts` | Return `tenantId` from `authorize()`, persist it in `jwt` + `session` callbacks, add `getTenantFilter` + `getTenantBranchFilter` helpers |
| `src/lib/business-profile.ts` | Add `tenantId` param to `getBusinessProfile()` |
| `src/app/api/branches/route.ts` | GET: add `tenantId` where filter |
| `src/app/api/users/route.ts` | GET: add `tenantId` where filter; POST: set `tenantId` from session |
| `src/app/api/users/[id]/route.ts` | PATCH: verify target user belongs to the admin's tenant |
| `src/app/api/customers/route.ts` | GET: replace inline ADMIN bypass with `getTenantBranchFilter` |
| `src/app/api/customers/[id]/route.ts` | GET/PATCH/DELETE: add ADMIN tenant check (currently ADMIN bypasses all branch checks) |
| `src/app/api/orders/route.ts` | GET: replace inline ADMIN bypass with `getTenantBranchFilter` |
| `src/app/api/orders/[id]/route.ts` | GET/PATCH: add ADMIN tenant check |
| `src/app/api/payments/route.ts` | GET: scope `orderFilter` with `getTenantBranchFilter` |
| `src/app/api/analytics/route.ts` | GET: replace `branchFilter = {}` for ADMIN with `getTenantBranchFilter` |
| `src/app/api/reports/dashboard/route.ts` | GET: same |
| `src/app/api/reports/weekly-payments/route.ts` | GET: same |
| `src/app/api/activity-logs/route.ts` | GET: scope ADMIN queries by `branch.tenantId` |
| `src/app/api/business-profile/route.ts` | GET/POST/PATCH: pass `tenantId` to `getBusinessProfile()` |

---

## Task 1: Schema — Add Tenant Model

**Files:**
- Modify: `prisma/schema.prisma`

This task adds the `Tenant` model and all `tenantId` fields. Run this first — every other task depends on the generated Prisma client.

- [ ] **Step 1.1: Add `Tenant` model + `TenantStatus` enum to `schema.prisma`**

Open `prisma/schema.prisma`. After the `datasource db` block and before the `Branch` model, insert:

```prisma
model Tenant {
  id        String       @id @default(cuid())
  name      String
  slug      String       @unique
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now())

  businessProfile BusinessProfile?
  users           User[]
  branches        Branch[]
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  DELETED
}
```

- [ ] **Step 1.2: Add `tenantId` to `Branch`**

In `schema.prisma`, find the `Branch` model. Add these two lines before the `@@index([name])` line:

```prisma
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
```

And add a new index after `@@index([name])`:

```prisma
  @@index([tenantId])
```

- [ ] **Step 1.3: Add `tenantId` to `User`**

In the `User` model, add before the `@@index([email])` line:

```prisma
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
```

And add after `@@index([branchId])`:

```prisma
  @@index([tenantId])
```

The `role` field comment should become: `// ADMIN, STAFF, VIEWER, SUPER_ADMIN`

- [ ] **Step 1.4: Add `tenantId` to `BusinessProfile`**

In the `BusinessProfile` model, add before `@@index([active])`:

```prisma
  tenantId  String?  @unique
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
```

- [ ] **Step 1.5: Regenerate Prisma client**

```bash
cd tailor-shop && yarn prisma generate
```

Expected output ends with: `✔ Generated Prisma Client`

- [ ] **Step 1.6: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors (the new `tenantId` fields will become available on `User`, `Branch`, `BusinessProfile` types).

- [ ] **Step 1.7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Tenant model and tenantId fields to schema"
```

---

## Task 2: Types + Auth — Add `tenantId` to JWT and Session

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`

This task wires `tenantId` into the login flow and adds the two query-filter helpers.

- [ ] **Step 2.1: Update `src/types/next-auth.d.ts`**

Replace the entire file with:

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    branchId: string | null;
    branchName: string | null;
    tenantId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      branchId: string | null;
      branchName: string | null;
      tenantId: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    branchId: string | null;
    branchName: string | null;
    tenantId: string | null;
  }
}
```

- [ ] **Step 2.2: Update `authorize()` in `src/lib/auth.ts` to return `tenantId`**

Find the `return { id: user.id, ... }` block inside `authorize`. Replace it with:

```typescript
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branch?.name ?? null,
          tenantId: user.tenantId,
        };
```

- [ ] **Step 2.3: Update `jwt` callback in `src/lib/auth.ts` to persist `tenantId`**

Find the `async jwt({ token, user })` callback. Replace it with:

```typescript
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
        token.tenantId = user.tenantId;
      }
      return token;
    },
```

- [ ] **Step 2.4: Update `session` callback to expose `tenantId`**

Find the `async session({ session, token })` callback. Replace it with:

```typescript
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.branchId = token.branchId as string | null;
        session.user.branchName = token.branchName as string | null;
        session.user.tenantId = token.tenantId as string | null;
      }
      return session;
    },
```

- [ ] **Step 2.5: Add `getTenantFilter` and `getTenantBranchFilter` to `src/lib/auth.ts`**

Add these two exported functions at the end of `src/lib/auth.ts`, after the `requireRole` function:

```typescript
// For models with a direct tenantId field: User, Branch, BusinessProfile.
// SUPER_ADMIN gets an empty filter (unrestricted). All other roles filter by their tenant.
export function getTenantFilter(
  session: import('next-auth').Session
): Record<string, unknown> {
  if (session.user.role === 'SUPER_ADMIN') return {};
  // tenantId is always non-null for non-SUPER_ADMIN users
  return { tenantId: session.user.tenantId! };
}

// For models scoped via Branch: Customer, Order, Payment, ActivityLog.
// ADMIN sees all branches in their tenant; STAFF/VIEWER see only their branch.
export function getTenantBranchFilter(
  session: import('next-auth').Session
): Record<string, unknown> {
  if (session.user.role === 'SUPER_ADMIN') return {};
  if (session.user.role === 'ADMIN') {
    return { branch: { tenantId: session.user.tenantId! } };
  }
  return { branchId: session.user.branchId! };
}
```

- [ ] **Step 2.6: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.7: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "feat: add tenantId to JWT/session and add tenant filter helpers"
```

---

## Task 3: Seed — Tenant-Aware Demo Data

**Files:**
- Modify: `prisma/seed.ts`

The seed must create a Tenant first, then attach all other records to it.

- [ ] **Step 3.1: Replace `prisma/seed.ts` with tenant-aware version**

Replace the entire file with:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED BLOCKED: never run seed in production.');
  }

  console.log('🌱 Starting database seed...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomUUID();
  const staffPassword = crypto.randomUUID();
  console.info(`[seed] admin password: ${adminPassword}`);
  console.info(`[seed] staff password: ${staffPassword}`);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

  // Clear all data in dependency order
  await prisma.passwordResetToken.deleteMany();
  await prisma.orderNotificationLog.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.fabricStock.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('✅ Cleared existing data');

  // 1. Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Smart Trendz',
      slug: 'smart-trendz',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // 2. Create business profile linked to tenant
  const businessProfile = await prisma.businessProfile.create({
    data: {
      tenantId: tenant.id,
      businessName: 'Smart Trendz',
      businessType: 'Tailor Shop',
      ownerName: 'Demo Owner',
      phoneNumber: '+233 24 000 0000',
      email: 'hello@smarttrendz.com',
      address: '123 Sample Street',
      city: 'Accra',
      country: 'Ghana',
      currency: 'GHS',
      invoicePrefix: 'ORD',
      receiptFooterNote: 'Thank you for choosing Smart Trendz.',
    },
  });

  console.log(`✅ Created business profile: ${businessProfile.businessName}`);

  // 3. Create branches linked to tenant
  const accra = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Accra',
      location: 'Accra, Greater Accra Region',
      active: true,
    },
  });

  const koforidua = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Koforidua',
      location: 'Koforidua, Eastern Region',
      active: true,
    },
  });

  console.log('✅ Created 2 branches: Accra and Koforidua');

  // 4. Create admin user linked to tenant (no branch)
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@smarttrendz.com',
      name: 'Admin User',
      password: adminPasswordHash,
      role: 'ADMIN',
      branchId: null,
      active: true,
    },
  });

  console.log('✅ Created admin user');

  // 5. Create staff users linked to tenant + branch
  const accraStaff = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'accra@smarttrendz.com',
      name: 'Accra Staff',
      password: staffPasswordHash,
      role: 'STAFF',
      branchId: accra.id,
      active: true,
    },
  });

  const koforiduaStaff = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'koforidua@smarttrendz.com',
      name: 'Koforidua Staff',
      password: staffPasswordHash,
      role: 'STAFF',
      branchId: koforidua.id,
      active: true,
    },
  });

  console.log('✅ Created 2 staff users');

  // 6. Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        fullName: 'Akosua Mensah',
        phoneNumber: '+233 24 123 4567',
        email: 'akosua.mensah@example.com',
        branchId: accra.id,
        createdBy: accraStaff.id,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Kwame Osei',
        phoneNumber: '+233 20 987 6543',
        branchId: accra.id,
        createdBy: accraStaff.id,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Ama Boateng',
        phoneNumber: '+233 26 555 1234',
        email: 'ama.boateng@example.com',
        branchId: koforidua.id,
        createdBy: koforiduaStaff.id,
      },
    }),
  ]);

  console.log('✅ Created 3 customers');

  // Helper to get dates relative to today
  const today = new Date();
  const getDate = (daysOffset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysOffset);
    return d;
  };

  // 7. Create orders with payments
  const ordersData = [
    {
      orderNumber: 'ORD-2026-0001',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Traditional Kente dress with matching headwrap',
      totalAmount: 450.0,
      status: 'IN_PROGRESS',
      orderDate: getDate(-15),
      dueDate: getDate(-2),
      createdBy: adminUser.id,
      payments: [
        { amount: 200.0, paymentDate: getDate(-15), paymentMethod: 'CASH', note: 'Initial deposit', createdBy: adminUser.id },
        { amount: 100.0, paymentDate: getDate(-8), paymentMethod: 'MOMO', note: 'Part payment', createdBy: adminUser.id },
      ],
    },
    {
      orderNumber: 'ORD-2026-0002',
      customerId: customers[1].id,
      branchId: accra.id,
      description: "Men's kaftan and trousers set",
      totalAmount: 280.0,
      status: 'READY',
      orderDate: getDate(-10),
      dueDate: getDate(1),
      createdBy: accraStaff.id,
      payments: [
        { amount: 280.0, paymentDate: getDate(-10), paymentMethod: 'CASH', note: 'Full payment upfront', createdBy: accraStaff.id },
      ],
    },
    {
      orderNumber: 'ORD-2026-0003',
      customerId: customers[2].id,
      branchId: koforidua.id,
      description: 'Wedding gown with embroidery',
      totalAmount: 850.0,
      status: 'IN_PROGRESS',
      orderDate: getDate(-20),
      dueDate: getDate(3),
      createdBy: koforiduaStaff.id,
      payments: [
        { amount: 400.0, paymentDate: getDate(-20), paymentMethod: 'CARD', note: 'Initial deposit', createdBy: koforiduaStaff.id },
        { amount: 200.0, paymentDate: getDate(-5), paymentMethod: 'MOMO', note: 'Second installment', createdBy: koforiduaStaff.id },
      ],
    },
    {
      orderNumber: 'ORD-2026-0004',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Business suit alterations',
      totalAmount: 120.0,
      status: 'COLLECTED',
      orderDate: getDate(-30),
      dueDate: getDate(-10),
      createdBy: adminUser.id,
      payments: [
        { amount: 60.0, paymentDate: getDate(-30), paymentMethod: 'CASH', note: 'Deposit', createdBy: adminUser.id },
        { amount: 60.0, paymentDate: getDate(-10), paymentMethod: 'CASH', note: 'Balance on collection', createdBy: adminUser.id },
      ],
    },
  ];

  for (const { payments, ...orderDetails } of ordersData) {
    const order = await prisma.order.create({
      data: {
        ...orderDetails,
        payments: { create: payments },
      },
    });
    console.log(`✅ Created order ${order.orderNumber}`);
  }

  console.log('\n🎉 Seed complete');
  console.log(`\n👥 Login credentials:`);
  console.log(`   admin@smarttrendz.com  / ${adminPassword}  (ADMIN)`);
  console.log(`   accra@smarttrendz.com  / ${staffPassword}  (STAFF – Accra)`);
  console.log(`   koforidua@smarttrendz.com / ${staffPassword}  (STAFF – Koforidua)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3.2: Commit seed script**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed script to create Tenant and link all records"
```

---

## Task 4: Business Profile Lib — Tenant-Aware Lookup

**Files:**
- Modify: `src/lib/business-profile.ts`

`getBusinessProfile()` does a `findFirst` which in multi-tenant context must filter by tenant.

- [ ] **Step 4.1: Update `getBusinessProfile` to accept `tenantId`**

In `src/lib/business-profile.ts`, replace the `getBusinessProfile` function:

```typescript
export async function getBusinessProfile(tenantId?: string | null) {
  return prisma.businessProfile.findFirst({
    where: {
      active: true,
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
}
```

- [ ] **Step 4.2: Update `src/app/api/business-profile/route.ts` to pass `tenantId`**

In the `GET`, `POST`, and `PATCH` handlers, import `requireAuth` and pass the session's tenantId.

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { getBusinessProfile, sanitizeBusinessProfileInput } from '@/lib/business-profile';
import { handleApiError, ConflictError, NotFoundError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'business-profile:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const session = await requireAuth();
    const profile = await getBusinessProfile(session.tenantId);
    return NextResponse.json({ data: profile, needsSetup: !profile });
  } catch (error) {
    return handleApiError(error, 'Error fetching business profile:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'business-profile:post', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const session = await requireRole(['ADMIN']);
    const existingProfile = await getBusinessProfile(session.tenantId);
    if (existingProfile) {
      throw new ConflictError('Business profile already exists. Use PATCH to update it.');
    }

    const raw = sanitizeBusinessProfileInput(await request.json()) as ReturnType<typeof sanitizeBusinessProfileInput> & { businessName: string };
    const profile = await prisma.businessProfile.create({
      data: { ...raw, tenantId: session.tenantId },
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Error creating business profile:');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'business-profile:patch', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const session = await requireRole(['ADMIN']);
    const profile = await getBusinessProfile(session.tenantId);
    if (!profile) throw new NotFoundError('Business profile not found');

    const data = sanitizeBusinessProfileInput(await request.json());
    const updated = await prisma.businessProfile.update({
      where: { id: profile.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Error updating business profile:');
  }
}
```

- [ ] **Step 4.3: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

- [ ] **Step 4.4: Commit**

```bash
git add src/lib/business-profile.ts src/app/api/business-profile/route.ts
git commit -m "feat: make business profile lookup tenant-scoped"
```

---

## Task 5: Branches + Users APIs

**Files:**
- Modify: `src/app/api/branches/route.ts`
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`

**Critical gap:** the branches GET currently returns all branches in the DB with no tenant filter. Users GET returns all users. Users POST creates a user with no `tenantId`. Users `[id]` PATCH allows an admin to modify users from other tenants.

- [ ] **Step 5.1: Update `src/app/api/branches/route.ts` GET**

Find the `GET` handler. Replace the Prisma query section:

```typescript
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'branches:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const session = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Record<string, unknown> = {
      ...(session.user.role !== 'SUPER_ADMIN' && { tenantId: session.user.tenantId }),
      ...(activeOnly && { active: true }),
    };

    const branches = await prisma.branch.findMany({
      where,
      include: {
        _count: {
          select: { users: true, customers: true, orders: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(branches);
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching branches:');
  }
}
```

Also update the import at the top of the file — change `import { requireAuth } from '@/lib/auth'` to:

```typescript
import { requireAuth, getTenantFilter } from '@/lib/auth';
```

- [ ] **Step 5.2: Update `src/app/api/users/route.ts` GET — add tenant filter**

In the `GET` handler, find where `const where = { ... }` is built. The current code has no tenant filter. Add `tenantId` scoping:

```typescript
    const where = {
      ...(session.user.role !== 'SUPER_ADMIN' && { tenantId: session.user.tenantId }),
      ...(branchId && { branchId }),
      ...(active !== null && { active: active === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
```

Also change the first line of the handler from `const user = await requireRole(['ADMIN'])` to `const session = await requireRole(['ADMIN'])`, and update all references to `user` to `session` in that handler.

- [ ] **Step 5.3: Update `src/app/api/users/route.ts` POST — set `tenantId` on new users**

In the `POST` handler, find the `prisma.user.create` call. Add `tenantId: session.tenantId` to the `data` object:

```typescript
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        branchId: branchId || null,
        active,
        tenantId: session.tenantId,
      },
      select: {
        id: true, email: true, name: true, role: true,
        branchId: true, active: true, createdAt: true, updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
```

Also verify the `branchId` provided by the admin belongs to their tenant. Add this check after the existing "Verify branch exists if provided" block:

```typescript
    // Verify the branch belongs to this tenant
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw new NotFoundError('Branch not found');
      if (session.tenantId && branch.tenantId !== session.tenantId) {
        throw new NotFoundError('Branch not found');
      }
    }
```

Remove the original separate branch existence check (the `const branch = await prisma.branch.findUnique...` block) and use only the new combined one above.

- [ ] **Step 5.4: Update `src/app/api/users/[id]/route.ts` PATCH — verify target user is in same tenant**

In the `PATCH` handler, after fetching `existingUser`, add a tenant check:

```typescript
    if (!existingUser) throw new NotFoundError('User not found');

    // Prevent cross-tenant modification
    if (admin.tenantId && existingUser.tenantId !== admin.tenantId) {
      throw new NotFoundError('User not found');
    }
```

- [ ] **Step 5.5: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

- [ ] **Step 5.6: Commit**

```bash
git add src/app/api/branches/route.ts src/app/api/users/route.ts "src/app/api/users/[id]/route.ts"
git commit -m "feat: add tenant scoping to branches and users API routes"
```

---

## Task 6: Customers + Orders APIs

**Files:**
- Modify: `src/app/api/customers/route.ts`
- Modify: `src/app/api/customers/[id]/route.ts`
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/orders/[id]/route.ts`

**Critical gap:** ADMIN queries for customers and orders currently use `where = {}` (no filter), which will return all tenants' data once multiple tenants exist.

- [ ] **Step 6.1: Update `src/app/api/customers/route.ts` GET**

Find the branch filtering block:

```typescript
    // Branch filtering: Non-admin users can only see their branch
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      where.branchId = user.branchId; // branch-isolated
    }
```

Replace it with:

```typescript
    // Tenant + branch scoping
    if (user.role === 'SUPER_ADMIN') {
      // no filter
    } else if (user.role === 'ADMIN') {
      where.branch = { tenantId: user.tenantId! };
    } else {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      where.branchId = user.branchId;
    }
```

Update the import to include `getTenantBranchFilter` (not needed here since we're inlining, but useful for consistency):

- [ ] **Step 6.2: Update `src/app/api/customers/[id]/route.ts` GET — add ADMIN tenant check**

In the GET handler, find this access check:

```typescript
    if (user.role !== 'ADMIN' && customer.branchId !== user.branchId) {
      throw new ForbiddenError('Customer not found');
    }
```

Replace it with (also update the `branch` include to fetch `tenantId`):

First update the `include` to include `tenantId` on branch:

```typescript
      branch: { select: { id: true, name: true, tenantId: true } },
```

Then replace the access check:

```typescript
    if (user.role === 'SUPER_ADMIN') {
      // unrestricted
    } else if (user.role === 'ADMIN') {
      if (customer.branch.tenantId !== user.tenantId) {
        throw new ForbiddenError('Customer not found');
      }
    } else if (customer.branchId !== user.branchId) {
      throw new ForbiddenError('Customer not found');
    }
```

- [ ] **Step 6.3: Update `src/app/api/customers/[id]/route.ts` PATCH — add ADMIN tenant check**

Find the PATCH handler's access check (`if (user.role !== 'ADMIN' && ...)`). Apply the same three-way check pattern from Step 6.2 after fetching the customer. The customer fetch in PATCH needs `branch: { select: { tenantId: true } }` in the include as well.

- [ ] **Step 6.4: Update `src/app/api/orders/route.ts` GET**

Find the branch filtering block for orders:

```typescript
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      where.branchId = user.branchId; // branch-isolated
    }
```

Replace with:

```typescript
    if (user.role === 'SUPER_ADMIN') {
      // no filter
    } else if (user.role === 'ADMIN') {
      (where as Record<string, unknown>).branch = { tenantId: user.tenantId! };
    } else {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      where.branchId = user.branchId;
    }
```

- [ ] **Step 6.5: Update `src/app/api/orders/[id]/route.ts` GET — add ADMIN tenant check**

Find the access check:

```typescript
    if (user.role !== 'ADMIN' && order.branchId !== user.branchId) {
      throw new ForbiddenError('Order not found');
    }
```

First add `tenantId: true` to the `branch` include in this handler:

```typescript
      branch: { select: { id: true, name: true, tenantId: true } },
```

Then replace the access check:

```typescript
    if (user.role === 'SUPER_ADMIN') {
      // unrestricted
    } else if (user.role === 'ADMIN') {
      if (order.branch.tenantId !== user.tenantId) {
        throw new ForbiddenError('Order not found');
      }
    } else if (order.branchId !== user.branchId) {
      throw new ForbiddenError('Order not found');
    }
```

- [ ] **Step 6.6: Update `src/app/api/orders/[id]/route.ts` PATCH — add ADMIN tenant check**

Apply the same three-way pattern for the PATCH handler's access check, using the branch's tenantId fetched via the order include.

- [ ] **Step 6.7: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

- [ ] **Step 6.8: Commit**

```bash
git add src/app/api/customers/route.ts "src/app/api/customers/[id]/route.ts" src/app/api/orders/route.ts "src/app/api/orders/[id]/route.ts"
git commit -m "feat: add tenant scoping to customers and orders API routes"
```

---

## Task 7: Payments + Analytics + Reports

**Files:**
- Modify: `src/app/api/payments/route.ts`
- Modify: `src/app/api/analytics/route.ts`
- Modify: `src/app/api/reports/dashboard/route.ts`
- Modify: `src/app/api/reports/weekly-payments/route.ts`

- [ ] **Step 7.1: Update `src/app/api/payments/route.ts` GET**

Find the branch filtering block for payments:

```typescript
    // Branch filtering: Non-admin users can only see their branch's payments
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      orderFilter.branchId = user.branchId; // branch-isolated
    }

    if (search || user.role !== 'ADMIN') {
      where.order = orderFilter;
    }
```

Replace with:

```typescript
    // Tenant + branch scoping via the nested order relation
    if (user.role === 'SUPER_ADMIN') {
      // no filter on order
    } else if (user.role === 'ADMIN') {
      (orderFilter as Record<string, unknown>).branch = { tenantId: user.tenantId! };
    } else {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      orderFilter.branchId = user.branchId;
    }

    // Always set where.order so the filter (or search) is applied
    if (search || user.role !== 'SUPER_ADMIN') {
      where.order = orderFilter;
    }
```

- [ ] **Step 7.2: Update `src/app/api/analytics/route.ts` GET**

Find:

```typescript
    const branchFilter: any = {};
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      branchFilter.branchId = user.branchId; // branch-isolated
    }
```

Replace with:

```typescript
    const branchFilter: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { branch: { tenantId: user.tenantId! } }
          : (() => {
              if (!user.branchId) throw new ValidationError('User not assigned to a branch');
              return { branchId: user.branchId };
            })();
```

- [ ] **Step 7.3: Update `src/app/api/reports/dashboard/route.ts` GET**

Find:

```typescript
    const branchFilter: any = {};
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      branchFilter.branchId = user.branchId; // branch-isolated
    }
```

Replace with:

```typescript
    const branchFilter: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { branch: { tenantId: user.tenantId! } }
          : (() => {
              if (!user.branchId) throw new ValidationError('User not assigned to a branch');
              return { branchId: user.branchId };
            })();
```

- [ ] **Step 7.4: Update `src/app/api/reports/weekly-payments/route.ts` GET**

Find:

```typescript
    const branchFilter =
      user.role !== 'ADMIN'
        ? { order: { branchId: user.branchId as string } } // branch-isolated
        : {};
```

Replace with:

```typescript
    const branchFilter: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { order: { branch: { tenantId: user.tenantId! } } }
          : { order: { branchId: user.branchId! } };
```

- [ ] **Step 7.5: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

- [ ] **Step 7.6: Commit**

```bash
git add src/app/api/payments/route.ts src/app/api/analytics/route.ts src/app/api/reports/dashboard/route.ts src/app/api/reports/weekly-payments/route.ts
git commit -m "feat: add tenant scoping to payments, analytics, and reports"
```

---

## Task 8: Activity Logs API

**Files:**
- Modify: `src/app/api/activity-logs/route.ts`

- [ ] **Step 8.1: Update `src/app/api/activity-logs/route.ts` GET**

Find the block that sets `filterBranchId`:

```typescript
    // Non-admin users can only see their branch's activities
    let filterBranchId = branchId;
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        throw new ValidationError('User not assigned to a branch');
      }
      filterBranchId = user.branchId;
    }

    const where: any = {
      ...(filterBranchId && { branchId: filterBranchId }),
      ...
    };
```

Replace with:

```typescript
    let filterBranchId = branchId;
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      filterBranchId = user.branchId;
    }

    // Build tenant scope filter for branch-level isolation
    const tenantScope: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { branch: { tenantId: user.tenantId! } }
          : {};  // STAFF/VIEWER are already constrained by filterBranchId

    const where: Record<string, unknown> = {
      ...tenantScope,
      ...(filterBranchId && { branchId: filterBranchId }),
      ...(userId && { userId }),
      ...(entity && { entity }),
      ...(action && { action }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };
```

- [ ] **Step 8.2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```

- [ ] **Step 8.3: Commit**

```bash
git add src/app/api/activity-logs/route.ts
git commit -m "feat: add tenant scoping to activity logs API"
```

---

## Task 9: Run Migration + Verify

This task applies the schema to the database, re-seeds, and manually verifies tenant isolation works end-to-end.

- [ ] **Step 9.1: Create migration file**

```bash
cd tailor-shop && yarn prisma migrate dev --name add-tenant-model
```

Expected output ends with: `✔ Your database is now in sync with your schema.`

If the command fails because the DB already has data that conflicts with the new `NOT NULL` constraint on `Branch.tenantId`, that's expected — proceed to the next step.

- [ ] **Step 9.2: Reset DB and re-seed**

```bash
yarn prisma migrate reset
```

Type `y` when prompted. This drops all data, re-applies all migrations, then automatically runs the seed script.

Expected output ends with login credentials printed like:
```
👥 Login credentials:
   admin@smarttrendz.com  / <uuid>  (ADMIN)
   accra@smarttrendz.com  / <uuid>  (STAFF – Accra)
   koforidua@smarttrendz.com / <uuid>  (STAFF – Koforidua)
```

Copy the printed passwords — they are random UUIDs.

- [ ] **Step 9.3: Start dev server**

```bash
yarn dev
```

Expected: server starts on port 3003 with no errors.

- [ ] **Step 9.4: Verify ADMIN login sees only tenant data**

Open `http://localhost:3003/login`. Log in as `admin@smarttrendz.com` with the password printed in Step 9.2.

1. Navigate to `/users` — should see 3 users: the admin + 2 staff. No users from other tenants (none exist yet, but the query is scoped).
2. Navigate to `/orders` — should see 4 orders, all from Smart Trendz tenant.
3. Navigate to `/customers` — should see 3 customers.

- [ ] **Step 9.5: Verify STAFF login sees only their branch**

Log out. Log in as `accra@smarttrendz.com`.

1. Navigate to `/customers` — should see 2 customers (Accra only, not Ama Boateng from Koforidua).
2. Navigate to `/orders` — should see 2 orders (Accra only).

- [ ] **Step 9.6: Verify TypeScript build passes**

```bash
yarn build
```

Expected: build completes with no type errors. (ESLint warnings are OK for now.)

- [ ] **Step 9.7: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — multi-tenancy core wired and verified"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ `Tenant` model with `id/name/slug/status/createdAt` — Task 1
- ✅ `tenantId String?` on User (nullable for SUPER_ADMIN) — Task 1
- ✅ `tenantId String` on Branch — Task 1
- ✅ `tenantId String? @unique` on BusinessProfile — Task 1
- ✅ `@@index([tenantId])` on User and Branch — Task 1
- ✅ `tenantId` in JWT at login — Task 2
- ✅ `getTenantFilter` helper — Task 2
- ✅ `getTenantBranchFilter` helper — Task 2
- ✅ Seed creates Tenant first, links Branch/User/BusinessProfile — Task 3
- ✅ Fresh DB start (`migrate reset`) — Task 9
- ✅ Branches GET scoped by tenant — Task 5
- ✅ Users GET + POST scoped by tenant — Task 5
- ✅ Users `[id]` PATCH cross-tenant protection — Task 5
- ✅ Customers GET + `[id]` tenant checks — Task 6
- ✅ Orders GET + `[id]` tenant checks — Task 6
- ✅ Payments GET tenant filter on order — Task 7
- ✅ Analytics tenant filter — Task 7
- ✅ Dashboard + weekly-payments tenant filter — Task 7
- ✅ Activity logs tenant filter — Task 8
- ✅ BusinessProfile scoped by tenantId — Task 4
- ✅ Middleware unchanged (session-based routing) — no task needed, confirmed in spec

**Not in scope (tracked in spec):**
- SUPER_ADMIN seed user — will be manually inserted or added in Phase 2
- Tenant signup UI — Phase 2
- Second tenant for isolation testing — Phase 2
