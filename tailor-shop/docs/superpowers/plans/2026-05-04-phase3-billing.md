# Phase 3 — Billing (Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add Stripe-backed subscription billing: FREE plan (1 branch, 50 orders/month) and PRO plan ($29/month, unlimited). Checkout, Billing Portal, webhook sync, plan-limit enforcement, and a billing settings page.

**Architecture:** Four API routes (`/api/billing/checkout|portal|webhook|status`), a `src/lib/billing.ts` helper, schema additions to `Tenant`, limit guards in orders and branches routes, and a `/settings/billing` page.

**Tech Stack:** Next.js 14, TypeScript strict, Prisma 5, `stripe` npm package.

---

### Task 1: Install Stripe and update schema

**Files:**
- Modify: `tailor-shop/prisma/schema.prisma`
- Shell: install `stripe` package

- [ ] **Step 1: Install Stripe SDK**

```bash
cd tailor-shop && yarn add stripe
```

Expected: stripe appears in package.json dependencies

- [ ] **Step 2: Add fields to Tenant model**

In `prisma/schema.prisma`, add to the `Tenant` model:

```prisma
stripeCustomerId     String?
stripeSubscriptionId String?
planStatus           String  @default("FREE")
trialEndsAt          DateTime?
```

(`plan` already exists from Phase 2)

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: TypeScript check**

```bash
yarn tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tailor-shop/prisma/schema.prisma tailor-shop/package.json tailor-shop/yarn.lock
git commit -m "feat(phase3): add Stripe billing fields to Tenant schema"
```

---

### Task 2: Create `src/lib/billing.ts`

**Files:**
- Create: `tailor-shop/src/lib/billing.ts`

- [ ] **Step 1: Create the billing utility**

```typescript
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
});

export interface PlanAccess {
  plan: string;
  planStatus: string;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export async function getPlanAccess(tenantId: string): Promise<PlanAccess> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      planStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!tenant) throw new Error('Tenant not found');
  return tenant;
}

export function isPro(access: PlanAccess): boolean {
  return (
    access.plan === 'PRO' &&
    (access.planStatus === 'TRIAL' || access.planStatus === 'ACTIVE')
  );
}

export function isFreePlan(access: PlanAccess): boolean {
  return access.plan === 'FREE' || access.planStatus === 'FREE';
}

export function stripeStatusToPlanStatus(status: string): string {
  switch (status) {
    case 'trialing': return 'TRIAL';
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled':
    case 'unpaid': return 'CANCELLED';
    default: return 'FREE';
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

Expected: no errors (stripe package types included)

- [ ] **Step 3: Commit**

```bash
git add tailor-shop/src/lib/billing.ts
git commit -m "feat(phase3): add billing utility and Stripe client"
```

---

### Task 3: Billing API routes

**Files:**
- Create: `tailor-shop/src/app/api/billing/checkout/route.ts`
- Create: `tailor-shop/src/app/api/billing/portal/route.ts`
- Create: `tailor-shop/src/app/api/billing/webhook/route.ts`
- Create: `tailor-shop/src/app/api/billing/status/route.ts`

- [ ] **Step 1: Create checkout route**

`src/app/api/billing/checkout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/billing';
import { handleApiError, ValidationError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await requireRole(['ADMIN']);
    if (!user.tenantId) throw new ValidationError('No tenant found');

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, stripeCustomerId: true },
    });
    if (!tenant) throw new ValidationError('Tenant not found');

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId: tenant.id },
      });
      customerId = customer.id;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID ?? '', quantity: 1 }],
      trial_period_days: 14,
      success_url: `${appUrl}/settings/billing?success=true`,
      cancel_url: `${appUrl}/settings/billing`,
      metadata: { tenantId: tenant.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Create portal route**

`src/app/api/billing/portal/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/billing';
import { handleApiError, ValidationError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const user = await requireRole(['ADMIN']);
    if (!user.tenantId) throw new ValidationError('No tenant found');

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { stripeCustomerId: true },
    });
    if (!tenant?.stripeCustomerId) {
      throw new ValidationError('No billing account found. Please subscribe first.');
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Create webhook route**

`src/app/api/billing/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe, stripeStatusToPlanStatus } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        if (!tenantId) break;

        const subscription = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string)
          : null;

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: 'PRO',
            planStatus: subscription?.status ? stripeStatusToPlanStatus(subscription.status) : 'TRIAL',
            stripeSubscriptionId: (session.subscription as string | null) ?? undefined,
            stripeCustomerId: session.customer as string,
            trialEndsAt: subscription?.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        if (!tenant) break;

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            planStatus: stripeStatusToPlanStatus(sub.status),
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        if (!tenant) break;

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { plan: 'FREE', planStatus: 'FREE', stripeSubscriptionId: null },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await prisma.tenant.updateMany({
          where: { stripeCustomerId: customerId },
          data: { planStatus: 'PAST_DUE' },
        });
        break;
      }
    }
  } catch {
    // Log internally but always return 200 to Stripe
    console.error('Webhook processing error for event', event.id);
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Create status route**

`src/app/api/billing/status/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user.tenantId) return NextResponse.json({ plan: 'FREE', planStatus: 'FREE', ordersThisMonth: 0, orderLimit: 50, hasStripeCustomer: false, trialEndsAt: null });

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { plan: true, planStatus: true, trialEndsAt: true, stripeCustomerId: true },
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const ordersThisMonth = await prisma.order.count({
      where: { branch: { tenantId: user.tenantId }, createdAt: { gte: startOfMonth } },
    });

    const orderLimit = tenant.plan === 'FREE' ? 50 : null;

    return NextResponse.json({
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      ordersThisMonth,
      orderLimit,
      hasStripeCustomer: !!tenant.stripeCustomerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add tailor-shop/src/app/api/billing/
git commit -m "feat(phase3): add billing API routes (checkout, portal, webhook, status)"
```

---

### Task 4: Plan limit enforcement

**Files:**
- Modify: `tailor-shop/src/app/api/orders/route.ts`
- Modify: `tailor-shop/src/app/api/branches/route.ts`

- [ ] **Step 1: Add order limit to POST /api/orders**

Read `src/app/api/orders/route.ts`. Find the `POST` handler. Near the start (after `requireRole`), add the plan limit check before the order is created:

```typescript
import { getPlanAccess, isFreePlan } from '@/lib/billing';

// Inside POST, after requireRole:
if (user.tenantId) {
  const access = await getPlanAccess(user.tenantId);
  if (isFreePlan(access)) {
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
}
```

- [ ] **Step 2: Add branch limit to POST /api/branches**

Read `src/app/api/branches/route.ts`. Find the `POST` handler. Add after `requireRole`:

```typescript
import { getPlanAccess, isFreePlan } from '@/lib/billing';

// Inside POST, after requireRole:
if (user.tenantId) {
  const access = await getPlanAccess(user.tenantId);
  if (isFreePlan(access)) {
    const branchCount = await prisma.branch.count({ where: { tenantId: user.tenantId } });
    if (branchCount >= 1) {
      throw new ForbiddenError('Free plan allows 1 branch. Upgrade to PRO for unlimited branches.');
    }
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add tailor-shop/src/app/api/orders/route.ts tailor-shop/src/app/api/branches/route.ts
git commit -m "feat(phase3): enforce FREE plan limits on order and branch creation"
```

---

### Task 5: Billing settings page

**Files:**
- Create: `tailor-shop/src/app/settings/billing/page.tsx`

- [ ] **Step 1: Create the billing page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface BillingStatus {
  plan: string;
  planStatus: string;
  trialEndsAt: string | null;
  ordersThisMonth: number;
  orderLimit: number | null;
  hasStripeCustomer: boolean;
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/status');
        if (res.ok) setStatus(await res.json());
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCheckout = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Failed to start checkout');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePortal = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Failed to open billing portal');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const planBadge = (plan: string, status: string) => {
    if (plan === 'PRO' && (status === 'ACTIVE' || status === 'TRIAL')) {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">PRO</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">FREE</span>;
  };

  const trialDaysLeft = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return 0;
    const diff = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your subscription and plan limits.</p>
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          You're now on PRO! Enjoy unlimited orders and branches.
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {status && (
        <>
          {/* Plan card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Current plan</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-900">{status.plan}</span>
                  {planBadge(status.plan, status.planStatus)}
                </div>
              </div>
              {status.planStatus === 'TRIAL' && status.trialEndsAt && (
                <div className="text-right">
                  <p className="text-sm font-medium text-purple-700">
                    {trialDaysLeft(status.trialEndsAt)} days left in trial
                  </p>
                  <p className="text-xs text-gray-500">
                    Trial ends {new Date(status.trialEndsAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {status.planStatus === 'PAST_DUE' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Payment past due
                </span>
              )}
            </div>

            {/* FREE plan limits */}
            {status.orderLimit !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Orders this month</span>
                  <span className="font-medium text-gray-900">
                    {status.ordersThisMonth} / {status.orderLimit}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      status.ordersThisMonth >= status.orderLimit
                        ? 'bg-red-500'
                        : status.ordersThisMonth >= status.orderLimit * 0.8
                        ? 'bg-yellow-400'
                        : 'bg-primary-500'
                    }`}
                    style={{ width: `${Math.min(100, (status.ordersThisMonth / status.orderLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Plan features */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              {status.plan === 'PRO' ? 'PRO includes' : 'Upgrade to PRO — $29/month'}
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                'Unlimited orders per month',
                'Unlimited branches',
                'Priority support',
                'Advanced analytics',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <svg className={`w-4 h-4 flex-shrink-0 ${status.plan === 'PRO' ? 'text-green-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {(status.plan === 'FREE' || status.planStatus === 'CANCELLED') && (
              <button
                onClick={handleCheckout}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Redirecting…' : 'Upgrade to PRO — $29/month'}
              </button>
            )}
            {(status.plan === 'PRO' || status.hasStripeCustomer) && status.planStatus !== 'FREE' && (
              <button
                onClick={handlePortal}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Redirecting…' : 'Manage subscription'}
              </button>
            )}
          </div>
        </>
      )}

      <div className="pt-2">
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to settings
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add tailor-shop/src/app/settings/billing/page.tsx
git commit -m "feat(phase3): add /settings/billing page"
```

---

### Task 6: Update Navigation to include Billing link

**Files:**
- Modify: `tailor-shop/src/components/Navigation.tsx` (or the settings page index)
- Modify: `tailor-shop/src/app/settings/page.tsx` (if it exists)

- [ ] **Step 1: Check settings page structure**

Read `src/app/settings/page.tsx` or `src/components/Navigation.tsx` to find where settings navigation links are.

- [ ] **Step 2: Add Billing link**

In the settings page or navigation, add a link to `/settings/billing` labelled "Billing & Plan" visible only to ADMIN users.

- [ ] **Step 3: TypeScript check and commit**

```bash
cd tailor-shop && yarn tsc --noEmit
git add tailor-shop/src/app/settings/ tailor-shop/src/components/
git commit -m "feat(phase3): add Billing link to settings navigation"
```

---

### Task 7: Update .env.example with Stripe vars

**Files:**
- Modify: `tailor-shop/.env.example`

- [ ] **Step 1: Add Stripe env vars to .env.example**

Add to `.env.example`:
```bash
# Stripe Billing (Phase 3)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRO_PRICE_ID=price_your_pro_monthly_price_id
NEXT_PUBLIC_APP_URL=http://localhost:3003
```

- [ ] **Step 2: Commit docs**

```bash
git add tailor-shop/.env.example tailor-shop/docs/superpowers/specs/2026-05-04-phase3-billing-design.md tailor-shop/docs/superpowers/plans/2026-05-04-phase3-billing.md
git commit -m "docs: add Phase 3 billing spec, plan, and env.example updates"
```
