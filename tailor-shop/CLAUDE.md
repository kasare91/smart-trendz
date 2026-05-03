# CLAUDE.md — Tailor Desk (Smart Trendz)

This file gives Claude (and any AI coding assistant) full context about this
codebase so every suggestion, refactor, or new feature fits the existing
architecture without needing to re-explain the project each session.

---

## Project overview

**Tailor Desk** is a multi-branch boutique and tailor shop management system
built for the Ghanaian market. It handles customer records, body measurements,
order tracking, payment collection, WhatsApp receipts, automated due-date
reminders, and cross-branch analytics.

Business name in production: **Smart Trendz**
Branches: Accra, Koforidua (more can be added via the Branch table)
Primary currency: GHS (Ghanaian Cedi)
Primary payment methods: Cash, Mobile Money (MoMo), Card, Other
Timezone: Africa/Accra

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 — App Router only (no Pages Router) |
| Language | TypeScript — strict mode, no `any` |
| Database | PostgreSQL via Supabase (SQLite for local dev) |
| ORM | Prisma 5 |
| Auth | NextAuth.js v4 — JWT sessions, CredentialsProvider |
| Styling | Tailwind CSS v3 — utility classes only, no custom CSS files |
| Charts | Recharts |
| SMS / WhatsApp | Twilio Node SDK |
| Email | SendGrid (primary) / Nodemailer SMTP (fallback) |
| File storage | Supabase Storage |
| Deployment | Vercel (with cron jobs via vercel.json) |
| Date handling | date-fns |
| PDF generation | @react-pdf/renderer |

---

## Repository layout

```
tailor-shop/
├── prisma/
│   ├── schema.prisma          # Single source of truth for the DB schema
│   ├── seed.ts                # Demo data — never run in production
│   └── clear.ts               # Clears all tables
├── src/
│   ├── app/
│   │   ├── api/               # All API routes (Next.js Route Handlers)
│   │   │   ├── auth/          # NextAuth [...nextauth] endpoint
│   │   │   ├── customers/     # Customer CRUD + /[id]/measurements
│   │   │   ├── orders/        # Order CRUD + /[id]/receipt + /[id]/whatsapp-receipt
│   │   │   ├── payments/      # Payment recording
│   │   │   ├── reports/       # Dashboard stats + weekly payments
│   │   │   ├── analytics/     # Business analytics
│   │   │   ├── branches/      # Branch management (admin only)
│   │   │   ├── users/         # User management (admin only)
│   │   │   ├── activity-logs/ # Audit trail (admin only)
│   │   │   ├── uploads/       # Image upload proxy to Supabase Storage
│   │   │   └── notifications/ # Manual send + daily cron
│   │   ├── customers/         # /customers, /customers/[id], /customers/[id]/measurements
│   │   ├── orders/            # /orders, /orders/[id], /orders/new
│   │   ├── payments/          # /payments (weekly report view)
│   │   ├── analytics/         # /analytics dashboard
│   │   ├── settings/          # Business profile settings
│   │   ├── setup/             # First-run business profile wizard
│   │   ├── login/             # /login
│   │   ├── layout.tsx         # Root layout (SessionProvider, Navigation)
│   │   ├── page.tsx           # Dashboard (/)
│   │   └── globals.css        # Tailwind base only — no custom rules
│   ├── components/
│   │   ├── Navigation.tsx     # Sticky top nav with role-aware links
│   │   ├── SessionProvider.tsx
│   │   ├── MeasurementForm.tsx # Customer body measurement form
│   │   └── (other shared components)
│   ├── lib/
│   │   ├── prisma.ts          # PrismaClient singleton
│   │   ├── auth.ts            # getServerSession helper + role checks
│   │   ├── utils.ts           # getDueDateUrgency, calculateDaysToDue, formatCurrency
│   │   ├── notifications.ts   # sendSMSReminder, sendEmailReminder, sendWhatsAppReceipt
│   │   ├── receipt-pdf.tsx    # OrderReceiptPDF component (@react-pdf/renderer)
│   │   ├── activity-log.ts    # logActivity, getActivityLogs, getUserActivitySummary
│   │   └── rate-limit.ts      # In-memory rate limiter (replace with Redis for multi-instance)
│   ├── types/
│   │   └── next-auth.d.ts     # Augmented Session/JWT types (id, role, branchId, branchName)
│   └── middleware.ts          # Protects all routes except /login and /setup
├── public/                    # Static assets
├── .env                       # Local secrets — NEVER commit real credentials
├── .env.example               # Template — commit this, not .env
├── vercel.json                # Build config + cron schedule
└── package.json               # name: "smart-trendz"
```

---

## Database schema — quick reference

All models live in `prisma/schema.prisma`. Key relationships:

```
BusinessProfile   (singleton — one row)
Branch            has many Users, Customers, Orders
User              belongs to Branch (nullable for ADMIN), role: ADMIN | STAFF | VIEWER
Customer          belongs to Branch, has many Orders, Measurements
Order             belongs to Customer + Branch, has many Payments, OrderNotificationLogs
Payment           belongs to Order
Measurement       belongs to Customer (versioned snapshots, newest first)
ActivityLog       belongs to User + Branch (audit trail)
OrderNotificationLog  unique on (orderId, reminderType, windowDate) — cron dedup
```

Status values (stored as String for SQLite compat, convert to enums on PostgreSQL):
- Order.status: `PENDING | IN_PROGRESS | READY | COLLECTED | CANCELLED`
- Payment.paymentMethod: `CASH | MOMO | CARD | OTHER`
- User.role: `ADMIN | STAFF | VIEWER`
- ActivityLog.action: `CREATE | UPDATE | DELETE`
- ActivityLog.entity: `ORDER | CUSTOMER | PAYMENT | USER | MEASUREMENT`

---

## Authentication & authorisation rules

Every API route handler must start with:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

Role matrix:

| Action | VIEWER | STAFF | ADMIN |
|---|---|---|---|
| Read own branch data | yes | yes | yes |
| Create orders / customers / payments | no | yes | yes |
| Update orders / customers | no | yes | yes |
| Delete any record | no | no | yes |
| Manage users / branches | no | no | yes |
| View activity logs | no | branch only | all branches |
| Read all branches | no | no | yes |

Branch isolation: for non-ADMIN users always add `where: { branchId: session.user.branchId }` to every Prisma query that touches Customer, Order, or Payment.

---

## API route conventions

- File location: `src/app/api/[resource]/route.ts` (collection) and `src/app/api/[resource]/[id]/route.ts` (item)
- Export named functions: `GET`, `POST`, `PATCH`, `DELETE`
- All handlers are `async` and receive `(request: Request, { params }: { params: { id: string } })`
- Return `NextResponse.json(data)` or `NextResponse.json({ error: 'message' }, { status: N })`
- Common status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error
- Log all mutations to ActivityLog via `logActivity()` from `src/lib/activity-log.ts`

Example skeleton:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // branch isolation for non-admins
  const where = session.user.role === 'ADMIN'
    ? { id: params.id }
    : { id: params.id, branchId: session.user.branchId };

  const record = await prisma.customer.findFirst({ where });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(record);
}
```

---

## Component conventions

- Server components by default. Add `'use client'` only when you need state, effects, or browser APIs.
- Tailwind only — no inline `style` objects, no CSS modules, no styled-components.
- Forms are controlled components with `useState`. Use `fetch` for API calls (no SWR or React Query currently in the project).
- Loading states: use a boolean `isLoading` state and disable submit buttons + show a spinner text.
- Error states: display error messages inline near the relevant field, not just as alerts.
- Shared UI components go in `src/components/`. Page-specific components can live alongside the page file.

---

## Notification system

Three channels, each independently toggled via env vars:

| Channel | Env flag | Provider |
|---|---|---|
| Email | `ENABLE_EMAIL_NOTIFICATIONS=true` | SendGrid (preferred) or SMTP fallback |
| SMS | `ENABLE_SMS_NOTIFICATIONS=true` | Twilio — plain SMS |
| WhatsApp | `ENABLE_WHATSAPP_NOTIFICATIONS=true` | Twilio WhatsApp Business API |

WhatsApp sender number is separate from the SMS number. Use `TWILIO_WHATSAPP_NUMBER` (not `TWILIO_PHONE_NUMBER`) for WhatsApp. Always prefix both `from` and `to` with `whatsapp:`.

Cron endpoint: `GET /api/notifications/cron?secret=CRON_SECRET`
Runs daily at 09:00 Africa/Accra via Vercel cron.
Deduplication: `OrderNotificationLog` unique on `(orderId, reminderType, windowDate)` — safe to call multiple times per day.

Reminder windows: 5 days, 3 days, 1 day, overdue.

---

## PDF receipts

Route: `GET /api/orders/[id]/receipt`
Library: `@react-pdf/renderer` — `renderToBuffer` on the server.
Component: `src/lib/receipt-pdf.tsx` — exports `OrderReceiptPDF`.
Response headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="receipt-ORD-2026-0001.pdf"
```

---

## Environment variables — full reference

```bash
# Database
DATABASE_URL        # Supabase PostgreSQL (pgbouncer) connection string
DIRECT_URL          # Supabase PostgreSQL direct connection (for migrations)

# Auth
NEXTAUTH_URL        # Full URL of the app (e.g. https://smarttrendz.vercel.app)
NEXTAUTH_SECRET     # Generated with: openssl rand -base64 32

# Timezone
TZ                  # Must be "Africa/Accra" in production

# Cron
CRON_SECRET         # Generated with: openssl rand -hex 32

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL     # https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY    # Server-only — never expose to client
SUPABASE_STORAGE_BUCKET      # e.g. "order-images"

# Rate limiting
RATE_LIMIT_BACKEND  # "memory" (dev/single instance) | "redis" (multi-instance)

# Twilio
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER         # For plain SMS
TWILIO_WHATSAPP_NUMBER      # For WhatsApp (format: +14155238886)

# Notifications toggles
ENABLE_SMS_NOTIFICATIONS         # "true" | "false"
ENABLE_EMAIL_NOTIFICATIONS       # "true" | "false"
ENABLE_WHATSAPP_NOTIFICATIONS    # "true" | "false"

# Email
FROM_EMAIL
SENDGRID_API_KEY    # Primary — if absent, falls back to SMTP
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
```

---

## Development commands

```bash
yarn dev                   # Start dev server on port 3003
yarn build                 # prisma generate + next build
yarn lint                  # ESLint

npx prisma generate        # Regenerate Prisma client after schema changes
npx prisma db push         # Push schema to dev SQLite (no migration file)
npx prisma migrate dev --name <name>   # Create a migration for PostgreSQL
npx prisma migrate deploy  # Apply migrations in production
npx prisma studio          # GUI database browser on port 5555
npx prisma db seed         # Seed demo data (dev only)
```

---

## Known issues & TODOs

| Priority | Item |
|---|---|
| Critical | Multi-branch API enforcement incomplete — branch filtering not yet applied in all order/customer routes |
| Critical | Rate limiter is in-memory — must swap to Upstash Redis before scaling to multiple Vercel instances |
| High | WhatsApp receipts need Twilio WhatsApp Business sender approval before going live |
| High | Customer Measurement model not yet in schema — see SKILLS.md for full spec |
| Medium | Export to CSV/PDF for weekly payment reports not implemented |
| Medium | Collection confirmation has no proof (photo/PIN/timestamp) |
| Medium | Status and paymentMethod fields should be migrated to PostgreSQL enums |
| Low | No dark-mode support in the UI yet |
| Low | No audit log viewer UI (data is captured but not surfaced) |

---

## Security rules — always follow these

1. Never read sensitive env vars on the client side. No `NEXT_PUBLIC_` prefix on secrets.
2. Never skip `getServerSession` in API routes — even GET endpoints expose customer data.
3. Never pass raw user input directly to Prisma `where` clauses without type validation.
4. Never seed the database in production — the seed script must throw if `NODE_ENV === 'production'`.
5. Never commit `.env` — only `.env.example` with placeholder values belongs in git.
6. Always hash passwords with `bcryptjs` (saltRounds: 10) before storing.
7. Rate-limit all auth endpoints via `src/lib/rate-limit.ts`.

---

## Coding style

- TypeScript strict — no `any`, no non-null assertions (`!`) without a comment explaining why it is safe.
- Prefer `const` over `let`. Never use `var`.
- Async/await over `.then()` chains.
- Early returns for error cases — keep the happy path un-nested.
- Prisma queries: always use `select` or `include` explicitly — do not return full models with sensitive fields (e.g. `password`) to API consumers.
- All monetary amounts are stored as `Float` in GHS. Always display with `formatCurrency()` from `src/lib/utils.ts`.
- Dates are stored in UTC. Display in Africa/Accra timezone using `date-fns` with the `TZDate` or `formatInTimeZone` pattern.
