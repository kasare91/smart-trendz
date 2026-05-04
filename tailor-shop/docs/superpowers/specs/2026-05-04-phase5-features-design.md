# Phase 5 Design Spec — UI Consistency & Feature Completeness

**Date:** 2026-05-04  
**Status:** Approved  
**Project:** Tailor Desk → SaaS Platform  
**Scope:** Phase 5 of 5 — complete the design system rollout across all remaining pages; eliminate `any` types; minor feature polish

---

## Goal

Phase 4 introduced the sidebar, dark mode, and three reusable UI components (`PageHeader`, `EmptyState`, `SkeletonList`), but only applied them to the Dashboard, Orders, and Customers pages. Phase 5 applies the same design system to every remaining page, cleans up `any` types, and ensures the whole app is dark-mode complete.

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Scope | UI consistency + type cleanup only | Phase 4 established the pattern; Phase 5 finishes the rollout |
| New features | None | Payments CSV export is already implemented; no new capabilities needed |
| Pages in scope | Analytics, Payments, Fabric Stock, Activity Logs, Users | These are the 5 pages not touched in Phase 4 |
| `any` cleanup | analytics/page.tsx, payments/page.tsx | These two pages still use `any` for state |
| New dependencies | None | Zero new npm packages |
| API changes | None | Pure UI work |

---

## File Map

| File | Change |
|---|---|
| `src/app/analytics/page.tsx` | Apply PageHeader, dark mode classes on all panels, fix `any` → typed interfaces |
| `src/app/payments/page.tsx` | Apply PageHeader, dark mode classes, fix `any` → typed interface |
| `src/app/fabric-stock/page.tsx` | Apply PageHeader, EmptyState, SkeletonList, dark mode |
| `src/app/activity-logs/page.tsx` | Apply PageHeader, dark mode classes on panels and filters |
| `src/app/users/page.tsx` | Apply PageHeader, EmptyState, SkeletonList, dark mode |

---

## Section 1: Analytics Page

### PageHeader

Replace the inline `<div>/<h1>` heading block with:
```tsx
<PageHeader title="Analytics" subtitle="Business insights and performance metrics" />
```

### Dark mode

- `StatCard` component within analytics: add `dark:bg-gray-800 dark:border-gray-700` on the card, `dark:text-gray-400` on labels, `dark:text-gray-100` on values
- Chart containers: `dark:bg-gray-800 dark:border-gray-700`
- Section headings: `dark:text-gray-100`
- Chart tooltip and legend are Recharts-managed — leave as-is (Recharts dark mode is out of scope per Phase 4 spec)

### Type cleanup

Replace `useState<any>(null)` with a typed `AnalyticsData` interface matching the shape returned by `/api/analytics`.

---

## Section 2: Payments Page

### PageHeader

Replace the inline heading with:
```tsx
<PageHeader title="Payments" subtitle="Weekly payment reports and exports" />
```

### Dark mode

- Date range selector tabs: `dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300`
- Custom date inputs: `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Report summary cards: `dark:bg-gray-800 dark:border-gray-700`
- Payment table container: `dark:bg-gray-800 dark:border-gray-700 dark:divide-gray-700`
- Table text: `dark:text-gray-100 dark:text-gray-400` throughout

### Type cleanup

Replace `useState<any>(null)` for `reportData` with a typed `PaymentReport` interface.

---

## Section 3: Fabric Stock Page

### PageHeader

Replace inline heading with:
```tsx
<PageHeader title="Fabric Stock" subtitle="Track lightweight fabric inventory by branch" action={<button>Add fabric</button>} />
```

### EmptyState

Replace `<div className="p-8 text-center text-gray-500">No fabric stock items yet</div>` with:
```tsx
<EmptyState
  icon={<CubeIcon 48px />}
  title="No fabric stock yet"
  body="Add your first fabric to start tracking inventory."
  action={{ label: 'Add fabric', onClick: () => setShowForm(true) }}
/>
```

### SkeletonList

Replace the loading text with `<SkeletonList rows={4} cols={4} />`.

### Dark mode

- Form panel: `dark:bg-gray-800`
- Inputs: `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Table: `dark:bg-gray-800 dark:divide-gray-700`
- Table header: `dark:bg-gray-700/50 dark:text-gray-400`
- Table cells: `dark:text-gray-100 dark:text-gray-400`
- Low-stock highlight row: `bg-amber-50 dark:bg-amber-900/20`

---

## Section 4: Activity Logs Page

### PageHeader

Replace inline heading (if present — the page may render heading differently) with:
```tsx
<PageHeader title="Activity Log" subtitle="Audit trail of all actions across branches" />
```

### Dark mode

- Filter panel: `dark:bg-gray-800 dark:border-gray-700`
- Filter inputs and selects: `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Log list container: `dark:bg-gray-800 dark:border-gray-700 dark:divide-gray-700`
- Log entry text: `dark:text-gray-100 dark:text-gray-400`
- Action badges: CREATE `dark:bg-green-900/30 dark:text-green-400`, UPDATE `dark:bg-amber-900/30 dark:text-amber-400`, DELETE `dark:bg-red-900/30 dark:text-red-400`
- Pagination controls: `dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800`

---

## Section 5: Users Page

### PageHeader

Replace inline heading with:
```tsx
<PageHeader title="Users" subtitle="Manage staff accounts and access levels" action={<button>New user</button>} />
```

### EmptyState

Replace any empty-users text with `<EmptyState icon={<UserCircleIcon 48px />} title="No users yet" body="..." action={{ label: 'Add user', onClick: ... }} />`.

### SkeletonList

Replace loading spinner with `<SkeletonList rows={4} cols={4} />`.

### Dark mode

- User list container: `dark:bg-gray-800 dark:border-gray-700`
- User rows: `dark:divide-gray-700 dark:hover:bg-gray-700`
- Text: `dark:text-gray-100 dark:text-gray-400`
- Modal: `dark:bg-gray-800 dark:border-gray-700`
- Modal inputs: `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Role badges: add dark variants to each color

---

## Out of Scope

- Recharts dark theme
- Settings page dark mode (complex, many sub-pages)
- Toast notification system
- New database models or API routes

---

## Verification

1. Visit each of the 5 pages in dark mode → no white panels, no dark-on-dark text
2. All 5 pages show PageHeader at the top
3. Fabric Stock and Users empty states render correctly
4. Fabric Stock and Users show skeleton while loading
5. `yarn tsc --noEmit` clean
