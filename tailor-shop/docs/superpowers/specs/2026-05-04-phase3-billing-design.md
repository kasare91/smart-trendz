# Phase 3 Design Spec — Billing (Stripe)

**Date:** 2026-05-04  
**Status:** Approved  
**Project:** Tailor Desk → SaaS Platform  
**Scope:** Phase 3 of 5 — monetisation layer on top of Phase 2 self-service signup

---

## Goal

Charge boutique tenants a monthly subscription for continued access. Phase 3 wires Stripe Checkout for subscription creation, Stripe Billing Portal for self-service plan management, plan-limit enforcement in the API, and a `/settings/billing` page showing current plan status and upgrade/manage buttons.

---

## Plans

| Plan | Price | Limits |
|---|---|---|
| FREE | $0 | 1 branch, 50 orders/month (read-only after limit) |
| PRO | $29/month | Unlimited branches, unlimited orders |

The `plan` stub field added in Phase 2 becomes the source of truth. Stripe webhook events keep it in sync.

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Stripe integration | Stripe Checkout + Billing Portal | Battle-tested, hosted UI, no PCI scope |
| Plan storage | `Tenant.plan` (already exists) + `Tenant.stripeCustomerId` + `Tenant.stripeSubscriptionId` | Minimal schema additions |
| Subscription status | Mirror from Stripe via webhooks | Single source of truth is Stripe |
| Trial | 14-day trial for PRO on signup | Lets users experience full app before payment |
| Currency | USD | Stripe USD is simplest; GHS Stripe requires Ghana entity |

---

## Schema Changes

### Modified: `Tenant`

```prisma
stripeCustomerId     String?
stripeSubscriptionId String?
planStatus           String  @default("TRIAL")  // TRIAL | ACTIVE | PAST_DUE | CANCELLED | FREE
trialEndsAt          DateTime?
```

`plan` (already exists from Phase 2) stays as `FREE | PRO`.

`planStatus` captures the Stripe subscription state:
- `TRIAL` — within 14-day trial (full PRO access)
- `ACTIVE` — paid subscription active
- `PAST_DUE` — payment failed, grace period
- `CANCELLED` — subscription cancelled
- `FREE` — on the free plan (no Stripe subscription)

---

## Stripe Setup

### Products & Prices

Created once in Stripe Dashboard (or via Stripe CLI):
- Product: `Tailor Desk PRO`
- Price: `price_xxx` — $29/month recurring

Env var: `STRIPE_PRO_PRICE_ID`

### Environment Variables

```bash
STRIPE_SECRET_KEY          # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET      # whsec_... from Stripe dashboard
STRIPE_PRO_PRICE_ID        # price_... for the PRO monthly price
NEXT_PUBLIC_APP_URL        # e.g. https://tailordesk.app (for redirect URLs)
```

---

## API Routes

### `POST /api/billing/checkout` — authenticated, ADMIN only

Creates a Stripe Checkout Session for the PRO plan.

1. `requireRole(['ADMIN'])`
2. Get or create Stripe Customer for the tenant (upsert `stripeCustomerId` on Tenant)
3. Create `stripe.checkout.sessions.create`:
   - `customer`: existing customer ID
   - `mode: 'subscription'`
   - `line_items`: `[{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }]`
   - `trial_period_days: 14`
   - `success_url`: `${APP_URL}/settings/billing?success=true`
   - `cancel_url`: `${APP_URL}/settings/billing`
   - `metadata`: `{ tenantId: user.tenantId }`
4. Return `{ url: session.url }`

### `POST /api/billing/portal` — authenticated, ADMIN only

Creates a Stripe Billing Portal session for managing/cancelling the subscription.

1. `requireRole(['ADMIN'])`
2. Look up `tenant.stripeCustomerId` — 400 if missing (not yet subscribed)
3. `stripe.billingPortal.sessions.create({ customer, return_url: ... })`
4. Return `{ url: session.url }`

### `POST /api/billing/webhook` — public, Stripe signature verified

Handles Stripe webhook events. Registered in Stripe Dashboard for:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Verifies signature with `stripe.webhooks.constructEvent`. Updates `Tenant.plan`, `Tenant.planStatus`, `Tenant.stripeSubscriptionId` based on event.

No auth required (Stripe signs the request). Returns `200` immediately to acknowledge.

### `GET /api/billing/status` — authenticated, ADMIN only

Returns the current billing status for the tenant:
```typescript
{
  plan: 'FREE' | 'PRO'
  planStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'FREE'
  trialEndsAt: string | null
  ordersThisMonth: number  // for FREE plan limit display
  orderLimit: number | null  // null = unlimited
  hasStripeCustomer: boolean
}
```

---

## Plan Limit Enforcement

### Order creation (`POST /api/orders`)

Before creating an order, check monthly limit for FREE plan tenants:

```typescript
if (tenant.plan === 'FREE' && tenant.planStatus === 'FREE') {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const count = await prisma.order.count({
    where: { branch: { tenantId: user.tenantId }, createdAt: { gte: startOfMonth } },
  });
  if (count >= 50) {
    throw new ForbiddenError('Monthly order limit reached. Upgrade to PRO for unlimited orders.');
  }
}
```

### Branch creation (`POST /api/branches`)

Block additional branches on FREE plan:

```typescript
if (tenant.plan === 'FREE' && tenant.planStatus === 'FREE') {
  const branchCount = await prisma.branch.count({ where: { tenantId: user.tenantId } });
  if (branchCount >= 1) {
    throw new ForbiddenError('Free plan allows 1 branch. Upgrade to PRO for unlimited branches.');
  }
}
```

A helper `getPlanAccess(tenantId)` in `src/lib/billing.ts` fetches plan + status in one query and is called at the start of both protected routes.

---

## Pages

### `/settings/billing`

`'use client'` page showing:

**Current plan section:**
- Plan badge: `FREE` (grey) or `PRO` (purple)
- Status: Active / Trial (with days remaining) / Past Due / Cancelled
- For FREE: "X of 50 orders used this month" progress bar; branch count

**Actions:**
- FREE plan: "Upgrade to PRO — $29/month" button → calls `POST /api/billing/checkout` → redirects to Stripe Checkout
- PRO/TRIAL: "Manage subscription" button → calls `POST /api/billing/portal` → redirects to Stripe Billing Portal
- PAST_DUE: yellow warning + "Update payment method" button → Billing Portal
- CANCELLED: "Reactivate subscription" button → Stripe Checkout

**Success banner:** When `?success=true` in URL: "You're now on PRO! Enjoy unlimited orders and branches."

---

## Webhook Event Handling

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `plan=PRO`, `planStatus=TRIAL` (if trial) or `ACTIVE`, store `stripeSubscriptionId` and `stripeCustomerId` |
| `customer.subscription.updated` | Update `planStatus` based on `subscription.status` mapping |
| `customer.subscription.deleted` | Set `plan=FREE`, `planStatus=FREE`, clear `stripeSubscriptionId` |
| `invoice.payment_failed` | Set `planStatus=PAST_DUE` |

Stripe `subscription.status` → `planStatus` mapping:
- `trialing` → `TRIAL`
- `active` → `ACTIVE`
- `past_due` → `PAST_DUE`
- `canceled` / `unpaid` → `CANCELLED`

---

## Security

- Webhook endpoint verifies Stripe signature — reject without it
- `metadata.tenantId` on checkout session must match a real Tenant row
- Billing portal only accessible if `stripeCustomerId` exists
- Plan limit checks use server-side Prisma queries (not client-passed values)

---

## Out of Scope

- Annual pricing / discount codes
- Usage-based billing
- Invoice downloads (available in Stripe Portal)
- Per-branch or per-seat pricing
- Ghana Stripe entity (requires local business registration)

---

## Verification

1. Self-service signup → new tenant gets `plan=FREE`, `planStatus=FREE`
2. Click "Upgrade to PRO" → redirected to Stripe Checkout (test mode)
3. Complete checkout → webhook fires → `plan=PRO`, `planStatus=TRIAL` in DB
4. Billing page shows PRO badge + trial countdown
5. Create 51st order on FREE plan → 403 "Monthly order limit reached"
6. Try to create 2nd branch on FREE plan → 403 "Free plan allows 1 branch"
7. Stripe Portal session created from "Manage subscription" button
8. `yarn tsc --noEmit` clean
