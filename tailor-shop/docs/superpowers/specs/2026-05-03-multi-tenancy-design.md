# Phase 1 Design Spec — Multi-Tenancy Core

**Date:** 2026-05-03  
**Status:** Approved  
**Project:** Tailor Desk → SaaS Platform  
**Scope:** Phase 1 of 5 — foundation that all other phases depend on

---

## Goal

Isolate data between multiple boutique tenants so that any tailor shop can sign up and use the platform with complete separation from every other shop's data. Phase 1 is purely infrastructural — it wires the multi-tenant foundation without changing the user-facing UI or experience.

---

## Decisions Made

| Question | Decision | Rationale |
|---|---|---|
| Schema approach | Lightweight separate `Tenant` model | Clean separation of account identity vs. shop branding; billing fields (`stripeCustomerId`, `plan`) can be added to `Tenant` in Phase 3 without restructuring |
| Tenant routing | Session-based (JWT) | Simplest path; no DNS wildcards, no route restructuring; works on Vercel free tier; subdomains can be layered on later as a "pro" feature |
| Existing data | Fresh DB start | Agreed — wipe and re-seed with tenant-aware data |

---

## Schema Changes

### New model: `Tenant`

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

`slug` is a URL-safe lowercase identifier (e.g. `smart-trendz`). Unique. Reserved for future subdomain routing.

### Modified: `User`

```prisma
tenantId String?
tenant   Tenant? @relation(fields: [tenantId], references: [id])

@@index([tenantId])
```

`tenantId` is nullable to accommodate the `SUPER_ADMIN` role, which belongs to no tenant.

Also add `SUPER_ADMIN` to the `UserRole` enum:

```prisma
enum UserRole {
  ADMIN
  STAFF
  VIEWER
  SUPER_ADMIN
}
```

### Modified: `Branch`

```prisma
tenantId String
tenant   Tenant @relation(fields: [tenantId], references: [id])

@@index([tenantId])
```

### Modified: `BusinessProfile`

```prisma
tenantId String @unique
tenant   Tenant @relation(fields: [tenantId], references: [id])
```

### Unchanged

`Customer`, `Order`, `Payment`, `Measurement`, `ActivityLog`, `OrderNotificationLog` — all already isolated by `branchId`. Since `Branch` now carries `tenantId`, downstream models inherit tenant isolation transitively. No changes needed.

---

## Session & JWT

### What gets added at login

`tenantId` is loaded from the database during the NextAuth `jwt` callback and stored in the JWT token. It is available in every API handler as `session.user.tenantId`.

```typescript
// src/types/next-auth.d.ts
interface JWT {
  id: string
  role: string
  branchId: string | null
  tenantId: string        // NEW
  branchName?: string
}

interface Session {
  user: {
    id: string
    role: string
    branchId: string | null
    tenantId: string      // NEW
    branchName?: string
  }
}
```

```typescript
// src/lib/auth.ts — jwt callback
async jwt({ token, user }) {
  if (user) {
    token.tenantId = user.tenantId
  }
  return token
}
```

### How API routes enforce isolation

**STAFF / VIEWER** queries are already tenant-safe because `branchId` belongs to exactly one tenant. No change needed.

**ADMIN** queries currently see all branches in the database. After Phase 1, ADMIN queries filter by `tenantId`:

```typescript
// Before (unsafe for multi-tenant):
const where = session.user.role === 'ADMIN' ? {} : { branchId: session.user.branchId }

// After (tenant-scoped):
const where = session.user.role === 'ADMIN'
  ? { branch: { tenantId: session.user.tenantId } }
  : { branchId: session.user.branchId }
```

For Branch and User queries (which reference `tenantId` directly):

```typescript
const where = session.user.role === 'SUPER_ADMIN'
  ? {}
  : { tenantId: session.user.tenantId }
```

### SUPER_ADMIN role

Platform-owner account only. `tenantId` is `null` in the JWT. All queries bypass the tenant filter. Used for:
- Viewing all tenants in a future admin dashboard
- Manually managing tenant accounts
- Debugging cross-tenant issues

`SUPER_ADMIN` users are never created via the self-service signup flow (Phase 2). They are seeded or manually inserted.

---

## Middleware

`src/middleware.ts` is unchanged. Tenant resolution happens inside API route handlers by reading `session.user.tenantId` from the JWT. No URL-level tenant routing logic is needed.

---

## Migration Strategy

### Step 1 — Update schema

Apply all schema changes above to `prisma/schema.prisma`.

### Step 2 — Create migration

```bash
yarn prisma migrate dev --name add-tenant-model
```

### Step 3 — Update seed script

`prisma/seed.ts` creates a complete tenant for development:

```typescript
// 1. Tenant
const tenant = await prisma.tenant.create({
  data: { name: 'Smart Trendz', slug: 'smart-trendz', status: 'ACTIVE' }
})

// 2. Branch
const branch = await prisma.branch.create({
  data: { name: 'Accra', tenantId: tenant.id, active: true }
})

// 3. Admin user
await prisma.user.create({
  data: {
    email: 'admin@smarttrendz.com',
    password: bcrypt.hashSync('changeme123', 10),
    name: 'Admin',
    role: 'ADMIN',
    tenantId: tenant.id,
    branchId: null,
    active: true,
  }
})
```

### Step 4 — Reset and re-seed

```bash
yarn prisma migrate reset   # drops all data, re-applies migrations, re-runs seed
```

---

## API Route Audit — What Changes

Every API route that uses an ADMIN-level `where: {}` (no filter) must be updated to add `tenantId` scoping. Routes already using `branchId` filters are safe as-is.

Routes using `getTenantFilter` (direct `tenantId` field):
- `GET /api/branches` — `where: getTenantFilter(session)`
- `GET /api/users` — `where: getTenantFilter(session)`

Routes using `getTenantBranchFilter` (scoped via branch):
- `GET /api/customers` — ADMIN currently uses `{}` via `buildBranchFilter`; replace with `getTenantBranchFilter(session)`
- `GET /api/orders` — same
- `GET /api/payments` — same (scoped via order → branch)
- `GET /api/analytics` — same
- `GET /api/reports/dashboard` — same
- `GET /api/reports/weekly-payments` — same
- `GET /api/activity-logs` — same

The existing `buildBranchFilter` in `src/lib/branch.ts` returns `{}` for ADMIN, which is unsafe for multi-tenant. `getTenantBranchFilter` replaces it everywhere.

---

## Helper utilities

Add two helpers to `src/lib/auth.ts` to centralize the tenant filter pattern:

```typescript
// For models with a direct tenantId field: User, Branch, BusinessProfile
export function getTenantFilter(session: Session) {
  if (session.user.role === 'SUPER_ADMIN') return {}
  return { tenantId: session.user.tenantId }
}

// For models scoped via branch: Customer, Order, Payment, ActivityLog
export function getTenantBranchFilter(session: Session) {
  if (session.user.role === 'SUPER_ADMIN') return {}
  if (session.user.role === 'ADMIN') return { branch: { tenantId: session.user.tenantId } }
  return { branchId: session.user.branchId }
}
```

---

## Out of Scope for Phase 1

- Tenant signup/onboarding UI → Phase 2
- Billing / plan limits → Phase 3
- Subdomain routing → optional future feature
- Tenant management dashboard → can be done as a simple seed/script for now
- Second branch (Koforidua) — add via seed or admin UI after Phase 1 is live

---

## Verification

After implementation, verify:

1. Log in as ADMIN — can only see branches/users belonging to their tenant
2. Log in as STAFF — unaffected; still sees only their branch
3. SUPER_ADMIN can see all tenants' data
4. Creating a new Branch via API sets `tenantId` from session, not from request body
5. `GET /api/users` without auth → 401
6. `GET /api/branches` for Tenant A cannot return Tenant B's branches
