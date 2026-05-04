# Phase 2 Design Spec — Self-Service Tenant Signup

**Date:** 2026-05-04  
**Status:** Approved  
**Project:** Tailor Desk → SaaS Platform  
**Scope:** Phase 2 of 5 — allows boutique owners to self-register without admin intervention

---

## Goal

Any boutique owner can visit `/signup`, create an account, and immediately start managing their shop. Phase 2 adds the full self-registration flow: public signup form, atomic tenant provisioning, optional email verification, and a clean handoff into the existing `/setup` and dashboard.

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Email verification | Optional, controlled by `ENABLE_EMAIL_NOTIFICATIONS` env flag | Email is already conditionally enabled; no new dependency |
| Default tenant plan | `FREE` string field on Tenant (no enum yet) | Billing is Phase 3; plan field is a forward-compatibility stub |
| Branch creation at signup | Yes — one branch, name from form | Every tenant needs at least one branch to operate |
| Redirect after signup | `/login?registered=true` | User confirms their credentials before entering the app |
| Existing users | `emailVerified` defaults to `true` — seed + existing admin accounts are unaffected | Avoids retroactive verification |

---

## Schema Changes

### Modified: `Tenant`

```prisma
plan String @default("FREE")  // FREE | PRO — Phase 3 will add billing logic
```

### Modified: `User`

```prisma
emailVerified          Boolean   @default(true)   // true for seeded/admin-created users
emailVerificationToken String?   @unique
emailVerificationExpires DateTime?
```

`emailVerificationToken` is a securely random hex string (32 bytes = 64 hex chars). It expires 24 hours after signup. After verification the token and expiry are nulled out.

---

## API Routes

### `POST /api/auth/signup` — public, no auth required

**Rate limited** using `RATE_LIMITS.auth`.

**Request body:**
```typescript
{
  businessName: string   // Tenant + BusinessProfile name
  ownerName: string      // Admin user's display name
  email: string          // Admin user's login email
  password: string       // Min 8 chars
  branchName: string     // First branch (e.g. "Accra Main")
  branchLocation: string // Branch location / city
}
```

**Success flow (atomic `$transaction`):**
1. Check email not already registered → 409 if taken
2. Validate password length ≥ 8
3. Generate `tenantSlug` from businessName (slugify: lowercase, replace non-alphanumeric with `-`, deduplicate)
4. `prisma.$transaction`:
   - Create `Tenant` (`name`, `slug`, `status: ACTIVE`, `plan: FREE`)
   - Create `Branch` (`name: branchName`, `location: branchLocation`, `tenantId`)
   - Hash password with `bcryptjs` (saltRounds: 10)
   - Create `User` (role `ADMIN`, `tenantId`, `branchId: null`, `emailVerified: !emailEnabled`, `emailVerificationToken`, `emailVerificationExpires`)
   - Create `BusinessProfile` (`businessName`, `tenantId`)
5. If `ENABLE_EMAIL_NOTIFICATIONS=true`: send verification email via `sendEmailReminder` pattern
6. Return `{ success: true }` with status 201

**Error responses:**
- `409 { error: 'Email already registered' }` — duplicate email
- `400 { error: 'Password must be at least 8 characters' }` — too short
- `400 { error: 'All fields are required' }` — missing required field
- `500` via `handleApiError` for unexpected errors

### `GET /api/auth/verify-email?token=<token>` — public, no auth required

1. Find user by `emailVerificationToken`
2. Check `emailVerificationExpires > now()` → 400 if expired
3. Update user: `emailVerified: true`, `emailVerificationToken: null`, `emailVerificationExpires: null`
4. Redirect to `/login?verified=true`

On invalid/missing token: redirect to `/login?verifyError=true`.

---

## Pages

### `/signup` — public

`'use client'` component. Not in middleware `matcher`, so accessible without auth.

**Form fields:**
- Business name (required)
- Your name (required)
- Email address (required)
- Password (required, min 8)
- Branch / location name (required)
- Branch city / location (required)

**States:**
- Idle → submit button enabled
- Submitting → button disabled, "Creating your account…"
- Success → full-page confirmation: "Account created! Check your email to verify" (if email enabled) or "Account created! You can now log in." with link to `/login`
- Error → inline message below form

**Visual design:** Matches `/login` — centered card on gray background, scissor icon, "Tailor Desk" heading.

### `/verify-email` — public (optional, for expired token UX)

This page is not strictly needed since the API redirects directly. Add only if verifying via a server action makes more sense. Decision: keep it simple — API route redirects to `/login?verified=true` or `/login?verifyError=true`. No separate page needed.

### `/login` — updated

Add:
- "Don't have an account? **Sign up**" link below the form pointing to `/signup`
- Banner for `?registered=true`: "Account created — please check your email to verify before logging in" (only when email enabled) or "Account created — you can now log in"
- Banner for `?verified=true`: "Email verified! You can now log in"
- Banner for `?verifyError=true`: "Verification link expired or invalid. Log in to request a new one" (deferred — resend flow is out of scope for Phase 2)

---

## Email Verification Message

Subject: `Verify your Tailor Desk account`

Body (plain text + HTML):
```
Hi {ownerName},

You're almost ready! Click the link below to verify your email address and activate your Tailor Desk account:

{verificationUrl}

This link expires in 24 hours.

— The Tailor Desk Team
```

`verificationUrl` = `{NEXTAUTH_URL}/api/auth/verify-email?token={token}`

If `ENABLE_EMAIL_NOTIFICATIONS=false`, skip the email entirely and set `emailVerified: true` immediately at signup so the user can log in right away.

---

## Slug Generation

```typescript
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}
```

If the generated slug already exists, append a 4-digit random suffix: `smart-trendz-4821`.

---

## Security

- Rate limit `POST /api/auth/signup` with `RATE_LIMITS.auth` (same as login)
- `emailVerificationToken` generated with `crypto.randomBytes(32).toString('hex')`
- Password validated server-side (≥ 8 chars); future phases can add complexity rules
- Email uniqueness enforced at DB level (`User.email @unique`)
- Tenant slug uniqueness enforced at DB level (`Tenant.slug @unique`)

---

## Out of Scope

- Resend verification email flow — can be done in a follow-up
- Invitation-based signup (admin invites staff) — staff are created by admin inside the app
- Social login (Google/GitHub OAuth)
- Trial period / plan activation — Phase 3

---

## Verification

1. `POST /api/auth/signup` with valid data → 201, Tenant/Branch/User/BusinessProfile created in DB
2. `POST /api/auth/signup` with duplicate email → 409
3. `POST /api/auth/signup` with 7-char password → 400
4. Log in with new credentials → session contains `tenantId`, `role: ADMIN`
5. If `ENABLE_EMAIL_NOTIFICATIONS=true`: verification email sent, `emailVerified: false` in DB; after clicking link → `emailVerified: true`
6. If `ENABLE_EMAIL_NOTIFICATIONS=false`: `emailVerified: true` immediately, user logs in without verification step
7. Login page shows "Sign up" link
8. `yarn tsc --noEmit` passes clean
