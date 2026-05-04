# Phase 5 — Feature Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Apply Phase 4's design system (PageHeader, EmptyState, SkeletonList, dark mode) to the five remaining pages, and eliminate `any` types.

**Architecture:** Pure UI — no API changes, no schema changes, no new npm packages.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS v3 `darkMode: 'class'`, existing components in `src/components/`.

---

### Task 1: Analytics page — PageHeader + dark mode + type cleanup

**Files:**
- Modify: `tailor-shop/src/app/analytics/page.tsx`

- [ ] **Step 1: Add PageHeader import and replace inline heading**

Add import:
```tsx
import PageHeader from '@/components/PageHeader';
```

Replace the heading block:
```tsx
<div>
  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics</h1>
  <p className="mt-1.5 text-sm text-gray-500">
    Business insights and performance metrics
  </p>
</div>
```

With:
```tsx
<PageHeader title="Analytics" subtitle="Business insights and performance metrics" />
```

- [ ] **Step 2: Fix `any` types — add AnalyticsData interface**

Add above the component function:
```typescript
interface MonthlyRevenue { month: string; revenue: number }
interface PaymentMethodStat { method: string; count: number; total: number }
interface OrderStatusStat { status: string; count: number }
interface CustomerLTV {
  customerId: string;
  customerName: string;
  phoneNumber: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
}
interface PopularItem { item: string; count: number; revenue: number }
interface AnalyticsData {
  overview: { totalRevenue: number; totalOrders: number; activeOrders: number; totalCustomers: number };
  monthlyRevenue: MonthlyRevenue[];
  paymentMethodStats: PaymentMethodStat[];
  orderStatusStats: OrderStatusStat[];
  customerLTV: CustomerLTV[];
  popularItems: PopularItem[];
}
```

Change:
```typescript
const [data, setData] = useState<any>(null);
```
To:
```typescript
const [data, setData] = useState<AnalyticsData | null>(null);
```

Also fix the `.map()` callbacks that used `(entry: any)`, `(customer: any)`, `(item: any)` — remove the `: any` annotations since TypeScript can now infer from the typed state. For the Tooltip `formatter`, change `(value: any)` to `(value: number)`.

- [ ] **Step 3: Add dark mode classes**

`StatCard` component (at the bottom of the file):
- Card div: add `dark:bg-gray-800 dark:border-gray-700`
- Label `p`: add `dark:text-gray-400`
- Value `p`: add `dark:text-gray-100`
- Icon wrapper div: keep color classes (they work in both modes)

Chart section containers (`bg-white rounded-xl`): add `dark:bg-gray-800 dark:border-gray-700`

Chart section headings (`text-gray-900`): add `dark:text-gray-100`

Top Customers table:
- Outer container: add `dark:bg-gray-800 dark:border-gray-700`
- Header section: add `dark:border-gray-700`
- Heading: add `dark:text-gray-100`
- Subtitle: add `dark:text-gray-400`
- Table `thead`: add `dark:bg-gray-700/50`
- `th` cells: add `dark:text-gray-400`
- Table `tbody`: add `dark:bg-gray-800 dark:divide-gray-700`
- `tr` hover: add `dark:hover:bg-gray-700`
- `td` with `text-gray-900`: add `dark:text-gray-100`
- `td` with `text-gray-500`: add `dark:text-gray-400`

Popular Items section:
- Outer container: add `dark:bg-gray-800 dark:border-gray-700`
- Header section: add `dark:border-gray-700`
- Headings: add `dark:text-gray-100 dark:text-gray-400`
- Item card `bg-gray-50 border-gray-200`: add `dark:bg-gray-700 dark:border-gray-600`
- Item name: add `dark:text-gray-100`
- Item detail text `text-gray-600`: add `dark:text-gray-400`

- [ ] **Step 4: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add tailor-shop/src/app/analytics/page.tsx
git commit -m "feat(phase5): apply PageHeader, dark mode, type cleanup to analytics page"
```

---

### Task 2: Payments page — PageHeader + dark mode + type cleanup

**Files:**
- Modify: `tailor-shop/src/app/payments/page.tsx`

- [ ] **Step 1: Add PageHeader import and replace inline heading**

Add import:
```tsx
import PageHeader from '@/components/PageHeader';
```

Replace:
```tsx
<div>
  <h1 className="text-3xl font-bold text-gray-900">Payments & Reports</h1>
  <p className="mt-1 text-sm text-gray-500">
    View payment history and weekly reports
  </p>
</div>
```

With:
```tsx
<PageHeader title="Payments & Reports" subtitle="View payment history and weekly reports" />
```

- [ ] **Step 2: Fix `any` type for reportData**

Read the full payments page. Look at what `reportData` contains — it has summary stats and an `allPayments` array. Add an interface:

```typescript
interface PaymentEntry {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  order: {
    orderNumber: string;
    description: string;
    customer: { fullName: string; phoneNumber: string };
  };
}

interface PaymentReport {
  totalRevenue: number;
  totalPayments: number;
  cashRevenue: number;
  momoRevenue: number;
  cardRevenue: number;
  otherRevenue: number;
  allPayments: PaymentEntry[];
}
```

Change:
```typescript
const [reportData, setReportData] = useState<any>(null);
```
To:
```typescript
const [reportData, setReportData] = useState<PaymentReport | null>(null);
```

- [ ] **Step 3: Add dark mode classes**

Read the full file to find all panels. Apply dark mode to:

Date range selector panel (`bg-white rounded-lg shadow p-6`): add `dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700`
- Panel heading `text-gray-900`: add `dark:text-gray-100`
- Inactive date range buttons (`bg-gray-100 text-gray-700`): add `dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600`
- Custom date inputs: add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Export button: already uses primary colors — keep as-is

Summary stats panel (`bg-white rounded-lg shadow p-6`): add `dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700`
- Panel heading: add `dark:text-gray-100`
- Stat labels `text-gray-500`: add `dark:text-gray-400`
- Stat values `text-gray-900` or colored: add `dark:text-gray-100` to gray ones

Payments table container (`bg-white rounded-lg shadow overflow-hidden`): add `dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700`
- Table `thead bg-gray-50`: add `dark:bg-gray-700/50`
- `th` cells `text-gray-500`: add `dark:text-gray-400`
- `tbody bg-white divide-gray-200`: add `dark:bg-gray-800 dark:divide-gray-700`
- `tr hover:bg-gray-50`: add `dark:hover:bg-gray-700`
- `td text-gray-900`: add `dark:text-gray-100`
- `td text-gray-500`: add `dark:text-gray-400`

- [ ] **Step 4: TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add tailor-shop/src/app/payments/page.tsx
git commit -m "feat(phase5): apply PageHeader, dark mode, type cleanup to payments page"
```

---

### Task 3: Fabric Stock page — PageHeader + EmptyState + SkeletonList + dark mode

**Files:**
- Modify: `tailor-shop/src/app/fabric-stock/page.tsx`

- [ ] **Step 1: Add imports**

```tsx
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';
```

- [ ] **Step 2: Replace heading with PageHeader**

The current heading structure is:
```tsx
<div className="flex flex-wrap items-start justify-between gap-4">
  <div>
    <h1 className="text-3xl font-bold text-gray-900">Fabric Stock</h1>
    <p className="mt-1 text-sm text-gray-500">Track lightweight fabric inventory by branch</p>
  </div>
  <button type="button" onClick={...} className="rounded-lg bg-primary-600 ...">Add fabric</button>
</div>
```

Replace with:
```tsx
<PageHeader
  title="Fabric Stock"
  subtitle="Track lightweight fabric inventory by branch"
  action={
    <button
      type="button"
      onClick={() => setShowForm((current) => !current)}
      className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 text-sm"
    >
      Add fabric
    </button>
  }
/>
```

- [ ] **Step 3: Replace loading state with SkeletonList**

Replace:
```tsx
<div className="p-8 text-center text-gray-500">Loading fabric stock...</div>
```

With:
```tsx
<SkeletonList rows={4} cols={4} />
```

- [ ] **Step 4: Replace empty state with EmptyState**

Replace:
```tsx
<div className="p-8 text-center text-gray-500">No fabric stock items yet</div>
```

With:
```tsx
<EmptyState
  icon={
    <svg width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  }
  title="No fabric stock yet"
  body="Add your first fabric to start tracking inventory by branch."
  action={{ label: 'Add fabric', onClick: () => setShowForm(true) }}
/>
```

- [ ] **Step 5: Add dark mode classes**

Form panel (`rounded-lg bg-white p-6 shadow`): add `dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700`
- Form labels `text-gray-700`: add `dark:text-gray-300`
- Form inputs: add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`

Table container (`overflow-hidden rounded-lg bg-white shadow`): add `dark:bg-gray-800 dark:shadow-none dark:border dark:border-gray-700`
- `thead bg-gray-50`: add `dark:bg-gray-700/50`
- `th text-gray-500`: add `dark:text-gray-400`
- `tbody divide-gray-200 bg-white`: add `dark:divide-gray-700 dark:bg-gray-800`
- Low-stock row `bg-amber-50`: add `dark:bg-amber-900/20`
- `td text-gray-900`: add `dark:text-gray-100`
- `td text-gray-700`: add `dark:text-gray-300`
- Quantity `-`/`+` buttons `border-gray-300 text-gray-700`: add `dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700`
- Delete button: keep red colors as-is

- [ ] **Step 6: TypeScript check and commit**

```bash
cd tailor-shop && yarn tsc --noEmit
git add tailor-shop/src/app/fabric-stock/page.tsx
git commit -m "feat(phase5): apply PageHeader, EmptyState, SkeletonList, dark mode to fabric stock"
```

---

### Task 4: Activity Logs page — PageHeader + dark mode

**Files:**
- Modify: `tailor-shop/src/app/activity-logs/page.tsx`

- [ ] **Step 1: Read the full file**

Read `src/app/activity-logs/page.tsx` fully. Identify the heading structure and all panels.

- [ ] **Step 2: Add PageHeader import and replace heading**

Add import:
```tsx
import PageHeader from '@/components/PageHeader';
```

Find the inline heading (if the page has one — it may be inside the authenticated content). Replace with:
```tsx
<PageHeader title="Activity Log" subtitle="Audit trail of all actions across branches" />
```

- [ ] **Step 3: Add dark mode classes**

Filter panel: add dark background, border, input, and select dark classes (same pattern as other pages: `dark:bg-gray-800 dark:border-gray-700` on container, `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100` on inputs/selects)

Log entries container: add `dark:bg-gray-800 dark:border-gray-700 dark:divide-gray-700`

Log entry rows: `dark:hover:bg-gray-700` on hover states, `dark:text-gray-100` on primary text, `dark:text-gray-400` on secondary text

Action badge dark variants — add dark variants to the existing ACTION_STYLES:
```typescript
const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};
```

Pagination controls: `dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700`

- [ ] **Step 4: TypeScript check and commit**

```bash
cd tailor-shop && yarn tsc --noEmit
git add tailor-shop/src/app/activity-logs/page.tsx
git commit -m "feat(phase5): apply PageHeader, dark mode to activity logs page"
```

---

### Task 5: Users page — PageHeader + EmptyState + SkeletonList + dark mode

**Files:**
- Modify: `tailor-shop/src/app/users/page.tsx`

- [ ] **Step 1: Read the full file**

Read `src/app/users/page.tsx` fully.

- [ ] **Step 2: Add imports and replace heading**

Add imports:
```tsx
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';
```

Find the inline heading and replace with:
```tsx
<PageHeader
  title="Users"
  subtitle="Manage staff accounts and access levels"
  action={
    <button
      onClick={() => setShowModal(true)}
      className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
    >
      + New User
    </button>
  }
/>
```

- [ ] **Step 3: Replace loading state with SkeletonList**

Find the loading text (e.g. `Loading users...` or similar) and replace with:
```tsx
<SkeletonList rows={4} cols={4} />
```

- [ ] **Step 4: Replace empty state with EmptyState**

If users.length === 0 renders a plain text message, replace with:
```tsx
<EmptyState
  icon={
    <svg width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  }
  title="No users yet"
  body="Add your first staff member to get started."
  action={{ label: 'Add user', onClick: () => setShowModal(true) }}
/>
```

- [ ] **Step 5: Add dark mode classes throughout**

User list container: `dark:bg-gray-800 dark:border-gray-700 dark:divide-gray-700`
User row text: `dark:text-gray-100 dark:text-gray-400`
Role badges: add dark variants for each role color
Active/Inactive badges: add dark variants
Action buttons: keep existing styles or add subtle dark variants

Modal overlay and modal box:
- Overlay: stays `bg-black/50` — fine
- Modal box (`bg-white rounded-lg shadow`): add `dark:bg-gray-800 dark:border dark:border-gray-700`
- Modal heading: add `dark:text-gray-100`
- Form labels: add `dark:text-gray-300`
- Form inputs and selects: add `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Error/success messages: add dark variants

- [ ] **Step 6: TypeScript check and commit**

```bash
cd tailor-shop && yarn tsc --noEmit
git add tailor-shop/src/app/users/page.tsx
git commit -m "feat(phase5): apply PageHeader, EmptyState, SkeletonList, dark mode to users page"
```

---

### Task 6: Final cleanup and docs commit

- [ ] **Step 1: Final TypeScript check**

```bash
cd tailor-shop && yarn tsc --noEmit
```

- [ ] **Step 2: Commit spec and plan docs**

```bash
git add tailor-shop/docs/superpowers/specs/2026-05-04-phase5-features-design.md
git add tailor-shop/docs/superpowers/plans/2026-05-04-phase5-features.md
git commit -m "docs: add Phase 5 feature completeness spec and implementation plan"
```
