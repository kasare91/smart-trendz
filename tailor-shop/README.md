# Tailor Desk

A multi-tenant boutique and tailor shop management system built for the Ghanaian market. Handles customer records, body measurements, order tracking, payment collection, WhatsApp receipts, automated due-date reminders, and cross-branch analytics.

**Primary currency:** GHS (Ghanaian Cedi)

---

## Features

### Core
- **Customer management** — contact details, order history, versioned body measurements
- **Order tracking** — full status lifecycle (PENDING → IN_PROGRESS → READY → COLLECTED), auto-numbered with configurable prefix
- **Payment recording** — partial or full payments, multiple methods (Cash, MoMo, Card, Other)
- **Outstanding balances** — recalculated live from payment sums
- **Weekly payment reports** — filter by This Week / Last Week / custom range, broken down by day and payment method
- **Due-date urgency system** — colour-coded orders across dashboard, order list, and detail views

### Advanced
- **Email / SMS / WhatsApp notifications** — automated daily cron at 09:00 WAT for 5-day, 3-day, 1-day, and overdue windows; manual send per order
- **PDF receipts** — branded, downloadable PDF for any order
- **Analytics dashboard** — monthly revenue trends, customer lifetime value, popular items, payment method distribution, order status breakdown (Recharts)
- **Multi-branch access control** — ADMIN sees all branches; STAFF and VIEWER are isolated to their own branch
- **Role-based access** — ADMIN / STAFF / VIEWER with enforced permissions on every API route
- **User management** — ADMIN can create, deactivate, and reassign staff accounts
- **Activity log / audit trail** — every mutation logged with user, branch, action, and metadata
- **Business profile & branding** — business name, logo (Supabase Storage), invoice prefix, receipt footer, brand colour
- **Dark mode** — system preference detection + manual toggle, persisted to `localStorage`
- **Forgot-password flow** — hashed reset token, generic response to prevent enumeration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 — App Router only |
| Language | TypeScript — strict mode |
| Database | PostgreSQL via Supabase (SQLite for local dev) |
| ORM | Prisma 5 |
| Auth | NextAuth.js v4 — JWT sessions, CredentialsProvider |
| Styling | Tailwind CSS v3 — dark mode via `darkMode: 'class'` |
| Charts | Recharts |
| Notifications | Twilio (SMS + WhatsApp) + SendGrid / Nodemailer (email) |
| File storage | Supabase Storage |
| Deployment | Vercel (cron via vercel.json) |
| Date handling | date-fns |
| PDF | @react-pdf/renderer |

---

## Prerequisites

- Node.js 18+
- Yarn (this project uses Yarn — do **not** use npm or pnpm)

---

## Installation & Setup

### 1. Install dependencies

```bash
cd tailor-shop
yarn install
```

### 2. Set up the database

```bash
yarn prisma:generate
yarn prisma:push    # pushes schema to SQLite dev DB; use migrate deploy for PostgreSQL
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`. Required for local development:

```env
NEXTAUTH_URL=http://localhost:3003
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

See `.env.example` for the full list including Twilio, SendGrid, and Supabase Storage.

### 4. Seed sample data

```bash
yarn prisma:seed
```

Creates one business profile (`Demo Boutique`), two branches (Accra and Koforidua), three demo users, three customers, seven orders, and multiple payments covering all urgency states.

**Demo users:**

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `admin123` | ADMIN (all branches) |
| `accra@example.com` | `staff123` | STAFF — Accra |
| `koforidua@example.com` | `staff123` | STAFF — Koforidua |

### 5. Run the development server

```bash
yarn dev    # http://localhost:3003
```

**First run:** if no business profile exists the app redirects to `/setup`. Complete the wizard before logging in.

---

## Project Structure

```
tailor-shop/
├── prisma/
│   ├── schema.prisma          # Single source of truth for the DB schema
│   ├── seed.ts                # Demo data — never run in production
│   └── production-pre-migration.ts  # One-time migration script for multi-branch rollout
├── src/
│   ├── app/
│   │   ├── api/               # Next.js Route Handlers
│   │   │   ├── auth/          # NextAuth [...nextauth] + forgot/reset password
│   │   │   ├── customers/     # CRUD + /[id]/measurements
│   │   │   ├── orders/        # CRUD + /[id]/receipt + /[id]/whatsapp-receipt
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
│   │   ├── payments/          # /payments (weekly report)
│   │   ├── analytics/         # /analytics
│   │   ├── activity-logs/     # /activity-logs (admin + staff)
│   │   ├── users/             # /users (admin only)
│   │   ├── fabric-stock/      # /fabric-stock
│   │   ├── settings/          # /settings
│   │   ├── setup/             # /setup (first-run wizard)
│   │   ├── login/             # /login
│   │   ├── layout.tsx         # Root layout (ThemeProvider, Navigation, content offset)
│   │   ├── page.tsx           # Dashboard (/)
│   │   └── globals.css        # Tailwind base + dark body background
│   ├── components/
│   │   ├── Navigation.tsx     # Sidebar (fixed 240 px desktop, overlay drawer mobile) with dark-mode toggle
│   │   ├── ThemeProvider.tsx  # Sets dark class on <html> from localStorage / prefers-color-scheme
│   │   ├── PageHeader.tsx     # Page title + subtitle + optional action slot
│   │   ├── EmptyState.tsx     # Empty list placeholder (icon + title + body + CTA)
│   │   ├── SkeletonList.tsx   # Animated pulse loading rows
│   │   ├── MeasurementForm.tsx
│   │   └── SessionProvider.tsx
│   ├── lib/
│   │   ├── prisma.ts          # PrismaClient singleton
│   │   ├── auth.ts            # authOptions, requireAuth(), requireRole()
│   │   ├── branch.ts          # buildBranchFilter() utility
│   │   ├── utils.ts           # getDueDateUrgency, calculateDaysToDue, formatCurrency, enrichOrder
│   │   ├── notifications.ts   # sendSMSReminder, sendEmailReminder, sendWhatsAppReceipt
│   │   ├── receipt-pdf.tsx    # OrderReceiptPDF (@react-pdf/renderer)
│   │   ├── activity-log.ts    # logActivity, getActivityLogs
│   │   ├── errors.ts          # AppError, ValidationError, NotFoundError
│   │   └── rate-limit.ts      # In-memory rate limiter
│   ├── types/
│   │   └── next-auth.d.ts     # Augmented Session / JWT types
│   └── middleware.ts          # Protects all routes except /login and /setup
├── docs/
│   └── superpowers/
│       ├── specs/             # Feature design documents
│       └── plans/             # Implementation plans
├── .env.example               # Environment variable reference — commit this, not .env
├── vercel.json                # Build config + cron schedule
└── package.json
```

---

## Usage

### Creating a new order

1. Navigate to **Orders** → **+ New Order**
2. Choose an existing customer or create one inline
3. Enter description, total amount, order date, and due date
4. Optionally add an initial deposit
5. Click **Create Order**

### Recording a payment

1. Open any order detail page
2. Click **+ Add Payment**
3. Enter amount, payment method, date, and optional note

### Viewing weekly reports

1. Navigate to **Payments**
2. Select This Week / Last Week / Custom Range
3. See total received, breakdown by payment method, and daily totals

### Sending a WhatsApp receipt

From the order detail page, click **Send WhatsApp Receipt**. Requires `ENABLE_WHATSAPP_NOTIFICATIONS=true` and Twilio WhatsApp Business sender approval.

### Toggling dark mode

Click the sun / moon icon at the bottom of the sidebar. The preference is saved to `localStorage` and applied on next load.

---

## API Endpoints

### Customers
- `GET /api/customers` — list + search
- `POST /api/customers` — create
- `GET /api/customers/[id]` — get
- `PATCH /api/customers/[id]` — update
- `DELETE /api/customers/[id]` — delete (ADMIN only)
- `GET /api/customers/[id]/measurements` — measurement history
- `POST /api/customers/[id]/measurements` — add measurement snapshot

### Orders
- `GET /api/orders` — list with filters (status, search, date range)
- `POST /api/orders` — create
- `GET /api/orders/[id]` — get with payments
- `PATCH /api/orders/[id]` — update
- `DELETE /api/orders/[id]` — delete (ADMIN only)
- `GET /api/orders/[id]/receipt` — download PDF receipt
- `POST /api/orders/[id]/whatsapp-receipt` — send WhatsApp receipt

### Payments
- `GET /api/payments` — list with date filter
- `POST /api/payments` — record payment

### Reports & Analytics
- `GET /api/reports/dashboard` — dashboard stats
- `GET /api/reports/weekly-payments` — weekly payment breakdown
- `GET /api/analytics` — business analytics aggregations

### Notifications
- `POST /api/notifications/send` — send reminder for one order (STAFF+)
- `GET /api/notifications/cron?secret=CRON_SECRET` — daily cron endpoint

### Admin
- `GET /api/branches` — list branches
- `POST /api/branches` — create branch (ADMIN only)
- `GET /api/users` — list users (ADMIN only)
- `POST /api/users` — create user (ADMIN only)
- `PATCH /api/users/[id]` — update user (ADMIN only)
- `GET /api/activity-logs` — audit trail (ADMIN full, STAFF own branch)

---

## Development Commands

```bash
yarn dev                   # Start dev server on port 3003
yarn build                 # prisma generate + next build
yarn lint                  # ESLint

yarn prisma:generate        # Regenerate Prisma client after schema changes
yarn prisma:push            # Push schema to dev SQLite (no migration file)
yarn prisma:migrate         # Create a migration for PostgreSQL
yarn prisma:studio          # GUI database browser on port 5555
yarn prisma:seed            # Seed demo data (dev only)
```

---

## Production Deployment

See [VERCEL-DEPLOYMENT-QUICK-START.md](./VERCEL-DEPLOYMENT-QUICK-START.md) for the step-by-step guide.

### Required environment variables

```env
DATABASE_URL        # Supabase PostgreSQL (pgbouncer) connection string
DIRECT_URL          # Supabase PostgreSQL direct connection (for migrations)
NEXTAUTH_URL        # Full URL of the app
NEXTAUTH_SECRET     # openssl rand -base64 32
TZ                  # Must be "Africa/Accra" in production
CRON_SECRET         # openssl rand -hex 32
```

See `.env.example` for the complete list.

---

## Authentication & Authorisation

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

Branch isolation: non-ADMIN users always receive data filtered to their `branchId`.

---

## Known Issues

| Priority | Item |
|---|---|
| Critical | Rate limiter is in-memory — replace with Upstash Redis before scaling to multiple Vercel instances |
| High | WhatsApp receipts require Twilio WhatsApp Business sender approval before going live |
| Medium | Weekly payment report export to CSV/PDF not implemented |
| Medium | Collection confirmation has no proof (photo/PIN/timestamp) |
| Medium | Order status and paymentMethod fields should be migrated to PostgreSQL enums |

---

## License

MIT
