# SKILLS.md — Tailor Desk Feature Modules

This file documents every feature module in the app: what it does, how it is
implemented, and how to extend it. Use this as the reference when adding new
features, debugging existing ones, or onboarding a new developer or AI assistant.

---

## Table of contents

1. [Customer management](#1-customer-management)
2. [Body measurements](#2-body-measurements)
3. [Order management](#3-order-management)
4. [Payment tracking](#4-payment-tracking)
5. [WhatsApp receipts](#5-whatsapp-receipts)
6. [PDF receipt generation](#6-pdf-receipt-generation)
7. [Due-date urgency system](#7-due-date-urgency-system)
8. [Automated reminders (cron)](#8-automated-reminders-cron)
9. [Multi-branch access control](#9-multi-branch-access-control)
10. [User & role management](#10-user--role-management)
11. [Analytics dashboard](#11-analytics-dashboard)
12. [Weekly payment reports](#12-weekly-payment-reports)
13. [Business profile & branding](#13-business-profile--branding)
14. [Activity log / audit trail](#14-activity-log--audit-trail)
15. [Image uploads](#15-image-uploads)
16. [Authentication & session](#16-authentication--session)

---

## 1. Customer management

**What it does:** Store and search customer contact details. Each customer
belongs to one branch and can have many orders and measurement snapshots.

**Key files:**
- `src/app/customers/page.tsx` — searchable list of customers
- `src/app/customers/[id]/page.tsx` — customer profile with order history
- `src/app/customers/new/page.tsx` — create customer form
- `src/app/api/customers/route.ts` — GET (list + search), POST (create)
- `src/app/api/customers/[id]/route.ts` — GET, PATCH, DELETE

**Prisma model:**
```prisma
model Customer {
  id          String   @id @default(cuid())
  fullName    String
  phoneNumber String?
  email       String?
  branchId    String
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())

  branch        Branch        @relation(...)
  orders        Order[]
  measurements  Measurement[]

  @@index([branchId])
  @@index([fullName])
}
```

**Search:** `GET /api/customers?search=kwame` — searches `fullName` and
`phoneNumber` with Prisma `contains` (case-insensitive on PostgreSQL).

**Extension points:**
- Add `address` or `city` fields if delivery is introduced.
- Add a `vip` boolean flag for loyalty tier tracking.

---

## 2. Body measurements

**What it does:** Capture and version a customer's body measurements over time.
Each snapshot is dated so staff can see how measurements change between visits.
Measurements are linked to orders so the seamstress always works from the
correct snapshot.

**Key files:**
- `src/app/customers/[id]/measurements/page.tsx` — timeline + add/edit
- `src/components/MeasurementForm.tsx` — grouped form (upper / lower / full body)
- `src/app/api/customers/[id]/measurements/route.ts` — GET list, POST create
- `src/app/api/customers/[id]/measurements/[measurementId]/route.ts` — PATCH, DELETE

**Prisma model:**
```prisma
model Measurement {
  id                  String   @id @default(cuid())
  customerId          String
  takenAt             DateTime @default(now())
  takenBy             String?

  bust                Float?
  chest               Float?
  waist               Float?
  hips                Float?
  shoulderWidth       Float?
  sleeveLength        Float?
  neckCircumference   Float?
  armhole             Float?
  bicep               Float?

  inseam              Float?
  outseam             Float?
  thigh               Float?
  knee                Float?
  calf                Float?
  ankleCircumference  Float?

  height              Float?
  backLength          Float?
  frontLength         Float?
  waistToKnee         Float?
  waistToFloor        Float?

  unit                String   @default("cm")
  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  customer  Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId])
}
```

**Form sections:**
- Upper body: bust/chest, waist, hips, shoulder width, sleeve length, neck, armhole, bicep
- Lower body: inseam, outseam, thigh, knee, calf, ankle
- Full body: height, back length, front length, waist-to-knee, waist-to-floor
- Meta: unit (cm/inches), takenAt date, notes

**Comparison feature:** The measurements page shows the two most recent
snapshots side-by-side. Fields that differ by more than 1 unit are highlighted
in amber.

**API contract:**
```
GET  /api/customers/:id/measurements        → Measurement[] (newest first)
POST /api/customers/:id/measurements        → Measurement (created)
PATCH /api/customers/:id/measurements/:mid  → Measurement (updated) — STAFF+
DELETE /api/customers/:id/measurements/:mid → 204 — ADMIN only
```

**Extension points:**
- Add a `measurementId` foreign key on the Order model so receipts can print
  the exact measurements used for that garment.
- Add a unit conversion utility: `convertMeasurement(value, from, to)`.

---

## 3. Order management

**What it does:** Track every garment order from creation to collection.
Orders have a status lifecycle, a due date, and a running payment balance.

**Key files:**
- `src/app/orders/page.tsx` — filterable order list
- `src/app/orders/[id]/page.tsx` — order detail with payments + actions
- `src/app/orders/new/page.tsx` — create order (choose or create customer inline)
- `src/app/api/orders/route.ts` — GET (list + filters), POST
- `src/app/api/orders/[id]/route.ts` — GET, PATCH, DELETE

**Status lifecycle:**
```
PENDING → IN_PROGRESS → READY → COLLECTED
                      ↘ CANCELLED (from any status)
```

**Order number format:** `{invoicePrefix}-{year}-{4-digit-sequence}`
Example: `ORD-2026-0042` — prefix is set in BusinessProfile.

**Balance calculation:**
```typescript
const balance = order.totalAmount - order.payments.reduce((s, p) => s + p.amount, 0);
```

**Filters on GET /api/orders:**
- `status` — filter by order status
- `branchId` — admin only, defaults to session user's branch
- `search` — matches order number or customer name
- `from` / `to` — date range on orderDate

**Extension points:**
- Add `garmentType` (enum: DRESS, SUIT, KENTE, BLAZER, SKIRT, TROUSERS, OTHER)
  for structured analytics on popular items.
- Add `fabricType` (free text) for inventory linkage.
- Add `collectedAt` timestamp + `collectedByNote` for proof of collection.

---

## 4. Payment tracking

**What it does:** Record partial or full payments against an order.
Multiple payments per order are supported. The outstanding balance is
recalculated on every read from the sum of payments.

**Key files:**
- `src/app/payments/page.tsx` — weekly payment report view
- `src/app/api/payments/route.ts` — GET (date-range list), POST

**Payment methods:** `CASH | MOMO | CARD | OTHER`

**Validation rules:**
- `amount` must be > 0
- `amount` must not exceed the current outstanding balance
- `paymentDate` defaults to today if not provided

**API contract:**
```
GET  /api/payments?from=2026-04-01&to=2026-04-30  → Payment[] with order + customer
POST /api/payments  body: { orderId, amount, paymentMethod, paymentDate?, note? }
```

**Extension points:**
- Add a `receiptNumber` field to Payment for physical receipt tracking.
- Add a refund flag (`isRefund: Boolean`) for returns or cancelled orders.

---

## 5. WhatsApp receipts

**What it does:** Send a formatted order receipt to the customer's WhatsApp
number immediately after payment or on demand from the order detail page.

**Key files:**
- `src/lib/notifications.ts` — `sendWhatsAppReceipt(params)`
- `src/app/api/orders/[id]/whatsapp-receipt/route.ts` — POST trigger endpoint

**Implementation notes:**
- Uses Twilio WhatsApp Business API — NOT the standard SMS API.
- Both `from` and `to` must be prefixed with `whatsapp:`.
- Sender number is `TWILIO_WHATSAPP_NUMBER` (separate from `TWILIO_PHONE_NUMBER`).
- Guard: `ENABLE_WHATSAPP_NOTIFICATIONS === 'true'`.
- Twilio sandbox number for testing: `+14155238886` — customers must opt in first.
- Production requires Twilio WhatsApp Business sender approval.

**Message template:**
```
*{businessName}*

Hi {customerName}, here is your receipt.

Order: {orderNumber}
Item: {description}
Due: {dueDate}

Total:    GHS {totalAmount}
Paid:     GHS {amountPaid}
Balance:  GHS {balance}

{footer from BusinessProfile}
Thank you for your business!
```

**API contract:**
```
POST /api/orders/:id/whatsapp-receipt  → { success: true, messageId } | { error }
```
Requires STAFF or ADMIN role. Returns 400 if customer has no phone number.

**Extension points:**
- Add a `whatsappSentAt` timestamp on Order to show last receipt date in UI.
- Add template variants: payment confirmation, order-ready notification.

---

## 6. PDF receipt generation

**What it does:** Generate a branded PDF receipt for any order that can be
downloaded, printed, or sent by email.

**Key files:**
- `src/lib/receipt-pdf.tsx` — `OrderReceiptPDF` React PDF component
- `src/app/api/orders/[id]/receipt/route.ts` — GET stream PDF

**Library:** `@react-pdf/renderer` — server-side `renderToBuffer`.

**PDF layout:**
1. Header: business logo + name + address + phone
2. Title: "ORDER RECEIPT" + order number
3. Customer section: name, phone, email
4. Order details: description, order date, due date, status
5. Payments table: date | method | amount (one row per payment)
6. Summary: total | paid | balance due (bold red if > 0)
7. Footer: BusinessProfile.receiptFooter + "Generated on {date}"

**Response headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="receipt-{orderNumber}.pdf"
```

**Extension points:**
- Add a `GET /api/orders/[id]/receipt?format=a5` param for different paper sizes.
- Add a batch PDF endpoint for printing all receipts in a date range.

---

## 7. Due-date urgency system

**What it does:** Colour-code orders by how close they are to their due date
so staff can prioritise at a glance.

**Key file:** `src/lib/utils.ts`

**Urgency levels:**

| Level | Days remaining | Tailwind classes |
|---|---|---|
| `overdue` | ≤ 0 | `bg-red-50 border-red-400 text-red-700` |
| `warning-1` | 1 | `bg-rose-50 border-rose-300 text-rose-700` |
| `warning-3` | 2–3 | `bg-amber-50 border-amber-300 text-amber-700` |
| `warning-5` | 4–5 | `bg-yellow-50 border-yellow-300 text-yellow-700` |
| `safe` | 6+ | `bg-slate-50 border-slate-200 text-slate-700` |

**Core utilities:**
```typescript
getDueDateUrgency(dueDate: Date): 'overdue' | 'warning-1' | 'warning-3' | 'warning-5' | 'safe'
calculateDaysToDue(dueDate: Date): number   // negative = overdue
```

All date comparisons use the Africa/Accra timezone boundary (midnight local time).

**Extension points:**
- Add a `COLLECTED` urgency level that returns a neutral green — orders already
  collected should not show urgency colours.

---

## 8. Automated reminders (cron)

**What it does:** Every morning at 09:00 Africa/Accra, scan all non-collected
non-cancelled orders and send SMS/email/WhatsApp reminders at the 5-day,
3-day, 1-day, and overdue windows.

**Key files:**
- `src/app/api/notifications/cron/route.ts` — cron endpoint
- `src/app/api/notifications/send/route.ts` — manual send for one order
- `src/lib/notifications.ts` — all notification helpers
- `vercel.json` — `"schedule": "0 9 * * *"` (UTC 09:00 = 09:00 WAT)

**Deduplication:** `OrderNotificationLog` has a unique constraint on
`(orderId, reminderType, windowDate)`. The cron is idempotent — running it
twice in a day does not double-send.

**Security:** Cron endpoint requires `?secret={CRON_SECRET}` query param.
Return 401 if missing or wrong.

**Reminder types:** `REMINDER_5_DAYS | REMINDER_3_DAYS | REMINDER_1_DAY | OVERDUE`

**Extension points:**
- Add a `READY_FOR_COLLECTION` reminder type triggered when order status
  changes to READY.
- Add opt-out support: a `notificationsEnabled` boolean on Customer.

---

## 9. Multi-branch access control

**What it does:** Isolate data between branches. Staff at the Accra branch
cannot see or modify Koforidua data and vice versa. Admins see everything.

**Key files:**
- `src/middleware.ts` — route protection (auth check, not branch isolation)
- All API routes — branch filtering must be applied per query

**Rules:**
- `User.branchId` is nullable — null means ADMIN (cross-branch access).
- Every Prisma query on Customer, Order, Payment must filter by `branchId`
  for non-ADMIN users.
- The session JWT carries `branchId` and `branchName` for the logged-in user.

**Pattern to apply in every collection API route:**
```typescript
const branchFilter = session.user.role === 'ADMIN'
  ? {}
  : { branchId: session.user.branchId };

const orders = await prisma.order.findMany({
  where: { ...branchFilter, ...otherFilters },
});
```

All collection routes apply this filter via `buildBranchFilter()` from `src/lib/branch.ts`.

**Extension points:**
- Add a branch selector dropdown in the Navigation for ADMIN users to filter
  the dashboard to one branch without logging in as that branch's staff.

---

## 10. User & role management

**What it does:** ADMIN users can create, deactivate, and reassign staff
accounts. Each user is assigned to one branch (or no branch for ADMINs).

**Key files:**
- `src/app/api/users/route.ts` — GET list, POST create (ADMIN only)
- `src/app/api/users/[id]/route.ts` — PATCH update, DELETE deactivate

**Roles:**

| Role | Description |
|---|---|
| ADMIN | Full access, all branches, user management |
| STAFF | Read + write on assigned branch, no user management |
| VIEWER | Read-only on assigned branch |

**Password policy:**
- Minimum 8 characters enforced at API level.
- Stored as bcrypt hash (saltRounds: 10).
- Forgot-password flow: hashed reset token stored in DB, generic response to prevent enumeration.

**Extension points:**
- Add `lastLoginAt` timestamp to User for inactive account detection.
- Add a `mustChangePassword` boolean to force password reset on first login.

---

## 11. Analytics dashboard

**What it does:** Business intelligence charts for monthly revenue trends,
top customers by lifetime value, popular items, payment method distribution,
and order status breakdown.

**Key files:**
- `src/app/analytics/page.tsx` — analytics page
- `src/app/api/analytics/route.ts` — aggregated data endpoint

**Charts (Recharts):**
- Monthly revenue: LineChart — last 6 months of payment totals
- Customer LTV: BarChart — top 10 customers by total paid
- Popular items: BarChart — most frequent garment types / description keywords
- Payment methods: PieChart — CASH vs MOMO vs CARD vs OTHER
- Order status: BarChart — current counts by status

**Data source:** All analytics are computed from Prisma aggregations at
request time. No materialised views or caching yet.

**Extension points:**
- Cache analytics response for 60 seconds using Next.js `revalidate`.
- Add branch selector so ADMIN can filter analytics per branch.
- Add date range picker (default: last 30 days / last 6 months / all time).

---

## 12. Weekly payment reports

**What it does:** Show how much cash was received in a given week, broken
down by day of week and payment method. Used by branch managers to
reconcile daily takings.

**Key files:**
- `src/app/payments/page.tsx` — report UI with period selector
- `src/app/api/reports/weekly-payments/route.ts` — filtered payment data
- `src/app/api/reports/dashboard/route.ts` — dashboard stats (active orders, balance, weekly total)

**Period options:** This Week | Last Week | Custom Range

**Report structure:**
- Total received in period
- Breakdown by payment method (CASH, MOMO, CARD, OTHER)
- Daily breakdown Monday → Sunday with per-method subtotals

**Extension points:**
- Add CSV export: `GET /api/reports/weekly-payments/export?from=&to=`.
- Add monthly comparison: current month vs previous month.

---

## 13. Business profile & branding

**What it does:** Store the shop's identity — name, logo, contact details,
currency symbol, invoice prefix, and receipt footer. Used across receipts,
PDFs, and notifications.

**Key files:**
- `src/app/setup/page.tsx` — first-run wizard (redirects here if no profile exists)
- `src/app/settings/page.tsx` — edit profile after setup
- `src/app/api/settings/route.ts` — GET + PATCH BusinessProfile

**BusinessProfile fields:**
```
businessName, businessType, ownerName, phone, email,
address, city, country, currency, invoicePrefix,
logoUrl, brandColor, receiptFooter
```

**Logo storage:** New uploads go to Supabase Storage via
`POST /api/uploads/images`. Legacy records may have base64 data URLs —
both are supported in the image display component.

**Invoice prefix:** Used to auto-generate order numbers.
Format: `{prefix}-{YYYY}-{0001}` — sequence resets per year.

**Extension points:**
- Add `openingHours` field for display in customer-facing notifications.
- Add multiple logos (light/dark) for different receipt contexts.

---

## 14. Activity log / audit trail

**What it does:** Record every significant mutation (create, update, delete)
with who did it, when, on which branch, and what changed. Useful for
resolving disputes and debugging data issues.

**Key files:**
- `src/lib/activity-log.ts` — `logActivity()`, `getActivityLogs()`, `getUserActivitySummary()`
- `src/app/api/activity-logs/route.ts` — GET logs with filters (ADMIN only)

**ActivityLog model:**
```prisma
model ActivityLog {
  id          String   @id @default(cuid())
  userId      String
  userName    String
  branchId    String?
  action      String   // CREATE | UPDATE | DELETE
  entity      String   // ORDER | CUSTOMER | PAYMENT | USER | MEASUREMENT
  entityId    String
  description String
  metadata    Json?
  createdAt   DateTime @default(now())
}
```

**Usage in API routes:**
```typescript
await logActivity({
  userId: session.user.id,
  userName: session.user.name ?? 'Unknown',
  branchId: session.user.branchId ?? null,
  action: 'CREATE',
  entity: 'ORDER',
  entityId: newOrder.id,
  description: `Created order ${newOrder.orderNumber} for ${customer.fullName}`,
  metadata: { orderNumber: newOrder.orderNumber, totalAmount: newOrder.totalAmount },
});
```

**Viewer page:** `src/app/activity-logs/page.tsx` — filterable table with user,
entity type, action, and date range filters. Accessible to ADMIN (all branches)
and STAFF (own branch only).

**Extension points:**
- Add IP address logging for security-sensitive actions.

---

## 15. Image uploads

**What it does:** Accept image file uploads from the browser, store them in
Supabase Storage, and return the public URL for saving to the database.

**Key files:**
- `src/app/api/uploads/images/route.ts` — POST multipart upload proxy

**Flow:**
1. Client sends `multipart/form-data` to `/api/uploads/images`.
2. Server reads the file buffer and uploads to Supabase Storage using the
   service role key (never exposed to client).
3. Server returns `{ url: "https://..." }`.
4. Client saves the URL to the relevant model field (BusinessProfile.logoUrl,
   Order description, etc.).

**Bucket:** configured via `SUPABASE_STORAGE_BUCKET` env var.

**Extension points:**
- Add per-order photo gallery (design references, completed work) using the
  `OrderPhoto` model defined in the future enhancements guide.
- Add image resizing on upload using Supabase Image Transformation.

---

## 16. Authentication & session

**What it does:** Secure login with email + password. JWT sessions (not
database sessions). Protected routes via middleware. Role and branch info
carried in the JWT.

**Key files:**
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `src/lib/auth.ts` — `authOptions`, `getServerSession` re-export
- `src/middleware.ts` — redirects unauthenticated requests to /login
- `src/types/next-auth.d.ts` — augmented session types

**JWT payload:**
```typescript
{
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF' | 'VIEWER'
  branchId: string | null
  branchName: string | null
}
```

**Session access in server components / route handlers:**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);
// session.user.id, session.user.role, session.user.branchId
```

**Session access in client components:**
```typescript
import { useSession } from 'next-auth/react';
const { data: session } = useSession();
```

**Forgot-password flow:**
1. User submits email to `POST /api/auth/forgot-password`.
2. If account exists: generate a token, hash it, store in DB with 1-hour expiry.
3. Send reset link via email (or log to console in dev).
4. Always return the same generic response (prevents account enumeration).
5. User clicks link → `POST /api/auth/reset-password` with token + new password.

**Extension points:**
- Add OAuth providers (Google) for staff logins if the business uses Google Workspace.
- Add session expiry warning UI (idle timeout after 8 hours of inactivity).
