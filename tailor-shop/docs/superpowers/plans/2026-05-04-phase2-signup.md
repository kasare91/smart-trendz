# Phase 2 — Self-Service Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any boutique owner to create a Tailor Desk account from the public `/signup` page, provisioning a Tenant, Branch, Admin User, and BusinessProfile in one atomic transaction, with optional email verification.

**Architecture:** Public API route (`POST /api/auth/signup`) creates all resources in a `$transaction`. Schema gains three email-verification fields on User and a `plan` stub on Tenant. Two pages: `/signup` (form) and login banner updates. Middleware is unchanged — new routes are not in the matcher and are therefore already public.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma 5, bcryptjs, Node.js `crypto`, existing `notifications.ts` for email.

---

### Task 1: Schema — add email verification fields + tenant plan stub

**Files:**
- Modify: `tailor-shop/prisma/schema.prisma`
- Modify: `tailor-shop/prisma/seed.ts`

- [ ] **Step 1: Add fields to schema**

In `prisma/schema.prisma`, add to the `Tenant` model (after `createdAt`):

```prisma
plan String @default("FREE")
```

Add to the `User` model (after `updatedAt`):

```prisma
emailVerified            Boolean   @default(true)
emailVerificationToken   String?   @unique
emailVerificationExpires DateTime?
```

- [ ] **Step 2: Push schema to dev DB**

```bash
cd tailor-shop && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Verify seed still runs**

Check `prisma/seed.ts` — the `emailVerified: true` default means no seed changes are required. Run:

```bash
NODE_ENV=development npx tsx prisma/seed.ts
```

Expected: completes without error (or skips if already seeded)

- [ ] **Step 5: TypeScript check**

```bash
yarn tsc --noEmit
```

Expected: no errors (new fields are optional / have defaults)

- [ ] **Step 6: Commit**

```bash
git add tailor-shop/prisma/schema.prisma
git commit -m "feat(phase2): add emailVerified fields to User and plan stub to Tenant"
```

---

### Task 2: Signup API route

**Files:**
- Create: `tailor-shop/src/app/api/auth/signup/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit(request as Parameters<typeof rateLimit>[0], { key: 'auth:signup', ...RATE_LIMITS.auth });
    if (limited) return limited;

    const body = await request.json();
    const { businessName, ownerName, email, password, branchName, branchLocation } = body;

    if (!businessName || !ownerName || !email || !password || !branchName || !branchLocation) {
      throw new ValidationError('All fields are required');
    }
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Ensure unique slug
    let slug = generateSlug(businessName);
    const slugExists = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (slugExists) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
    const emailVerificationToken = emailEnabled
      ? crypto.randomBytes(32).toString('hex')
      : null;
    const emailVerificationExpires = emailEnabled
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;
    const emailVerified = !emailEnabled;

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: businessName, slug, status: 'ACTIVE', plan: 'FREE' },
      });

      const branch = await tx.branch.create({
        data: { name: branchName, location: branchLocation, tenantId: tenant.id, active: true },
      });

      await tx.user.create({
        data: {
          email,
          name: ownerName,
          password: passwordHash,
          role: 'ADMIN',
          tenantId: tenant.id,
          branchId: null,
          active: true,
          emailVerified,
          emailVerificationToken,
          emailVerificationExpires,
        },
      });

      await tx.businessProfile.create({
        data: { businessName, tenantId: tenant.id },
      });

      // suppress unused var warning
      void branch;
    });

    if (emailEnabled && emailVerificationToken) {
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${emailVerificationToken}`;
      // Fire-and-forget — don't fail signup if email fails
      const { sendEmailReminder } = await import('@/lib/notifications');
      sendEmailReminder({
        to: email,
        subject: 'Verify your Tailor Desk account',
        body: `Hi ${ownerName},\n\nClick the link below to verify your email address:\n\n${verificationUrl}\n\nThis link expires in 24 hours.\n\n— The Tailor Desk Team`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tailor-shop/src/app/api/auth/signup/route.ts
git commit -m "feat(phase2): add POST /api/auth/signup public tenant provisioning route"
```

---

### Task 3: Email verification API route

**Files:**
- Create: `tailor-shop/src/app/api/auth/verify-email/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?verifyError=true`);
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
    select: { id: true, emailVerificationExpires: true },
  });

  if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    return NextResponse.redirect(`${baseUrl}/login?verifyError=true`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return NextResponse.redirect(`${baseUrl}/login?verified=true`);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tailor-shop/src/app/api/auth/verify-email/route.ts
git commit -m "feat(phase2): add GET /api/auth/verify-email token verification route"
```

---

### Task 4: Signup page (`/signup`)

**Files:**
- Create: `tailor-shop/src/app/signup/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    branchName: '',
    branchLocation: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Signup failed. Please try again.');
        return;
      }
      // We don't know here if email was sent — show generic success
      setSuccess(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account created!</h2>
          <p className="text-gray-600 text-sm">
            Check your email for a verification link, then log in to start managing your boutique.
            If you don&apos;t receive an email, you can log in directly.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">✂️</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 tracking-tight">
            Create your boutique
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
              <input
                name="businessName"
                type="text"
                required
                value={form.businessName}
                onChange={handleChange}
                placeholder="Smart Trendz Boutique"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input
                name="ownerName"
                type="text"
                required
                value={form.ownerName}
                onChange={handleChange}
                placeholder="Ama Mensah"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="ama@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch name</label>
              <input
                name="branchName"
                type="text"
                required
                value={form.branchName}
                onChange={handleChange}
                placeholder="Main Branch"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / City</label>
              <input
                name="branchLocation"
                type="text"
                required
                value={form.branchLocation}
                onChange={handleChange}
                placeholder="Accra"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating your account…' : 'Create account'}
          </button>

          <p className="text-xs text-center text-gray-500">
            By signing up you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tailor-shop/src/app/signup/page.tsx
git commit -m "feat(phase2): add public /signup page"
```

---

### Task 5: Update login page with signup link and status banners

**Files:**
- Modify: `tailor-shop/src/app/login/page.tsx`

- [ ] **Step 1: Read the current login page**

Read `tailor-shop/src/app/login/page.tsx` — understand its current structure.

- [ ] **Step 2: Add `useSearchParams` and banner state**

At the top of the component, add:

```typescript
import { useSearchParams } from 'next/navigation';
// inside component:
const searchParams = useSearchParams();
const registered = searchParams.get('registered') === 'true';
const verified = searchParams.get('verified') === 'true';
const verifyError = searchParams.get('verifyError') === 'true';
```

- [ ] **Step 3: Add banners above the form**

After the `{error && ...}` block (or near the top of the form), add:

```tsx
{registered && (
  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
    Account created — check your email to verify, then log in.
  </div>
)}
{verified && (
  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
    Email verified! You can now log in.
  </div>
)}
{verifyError && (
  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
    Verification link expired or invalid. You can still log in if your account has no email restriction.
  </div>
)}
```

- [ ] **Step 4: Add signup link**

Below the form's submit button, add:

```tsx
<p className="text-center text-sm text-gray-600">
  Don&apos;t have an account?{' '}
  <Link href="/signup" className="font-medium text-primary-600 hover:text-primary-500">
    Sign up
  </Link>
</p>
```

Import `Link` from `'next/link'` if not already imported.

- [ ] **Step 5: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add tailor-shop/src/app/login/page.tsx
git commit -m "feat(phase2): add signup link and status banners to login page"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

Expected: zero errors

- [ ] **Step 2: Test signup flow manually (if dev server available)**

```bash
# Optionally start dev server
yarn dev &
# In browser: visit http://localhost:3003/signup
# Fill in all fields, submit
# Verify redirect to /login?registered=true
# Log in with new credentials
# Verify session has tenantId and role=ADMIN
```

- [ ] **Step 3: Commit docs**

```bash
git add tailor-shop/docs/superpowers/specs/2026-05-04-phase2-signup-design.md
git add tailor-shop/docs/superpowers/plans/2026-05-04-phase2-signup.md
git commit -m "docs: add Phase 2 signup spec and implementation plan"
```
