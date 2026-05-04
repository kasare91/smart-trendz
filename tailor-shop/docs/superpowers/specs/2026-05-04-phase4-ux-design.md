# Phase 4 Design Spec — UI/UX Overhaul

**Date:** 2026-05-04  
**Status:** Approved  
**Project:** Tailor Desk → SaaS Platform  
**Scope:** Phase 4 of 5 — polish a proven product; no new features, only visual and UX improvements

---

## Goal

Replace the horizontal top-nav with a modern sidebar layout, add dark mode, and introduce three reusable UI components (`PageHeader`, `EmptyState`, `SkeletonList`) that bring visual consistency to all pages. No API changes. No new data models.

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Nav layout | Left sidebar (240px desktop, overlay drawer on mobile) | More scalable for growing nav items; standard for SaaS dashboards |
| SVG icons | Replace emoji nav icons with inline SVG | More professional, consistent sizing, dark-mode friendly |
| Dark mode | Tailwind `dark:` classes + `ThemeProvider` client component | No new dependency; persisted to `localStorage`, system default |
| Toast notifications | Out of scope | Would add complexity; not agreed |
| Dashboard redesign | Modest improvements only (apply PageHeader + EmptyState) | Full dashboard rebuild is out of scope for this phase |
| New dependencies | None | Zero new npm packages |

---

## File Map

| File | Change |
|---|---|
| `src/app/layout.tsx` | Wrap app in sidebar shell; replace Navigation import |
| `src/components/Navigation.tsx` | Rewrite as `Sidebar` component (sidebar layout) |
| `src/components/ThemeProvider.tsx` | NEW — dark mode provider with localStorage persistence |
| `src/components/PageHeader.tsx` | NEW — title + subtitle + optional right-side action slot |
| `src/components/EmptyState.tsx` | NEW — icon + heading + body + optional CTA button |
| `src/components/SkeletonList.tsx` | NEW — generic skeleton rows for list pages |
| `src/app/page.tsx` | Apply PageHeader |
| `src/app/orders/page.tsx` | Apply PageHeader + EmptyState + SkeletonList |
| `src/app/customers/page.tsx` | Apply PageHeader + EmptyState + SkeletonList |
| `src/app/globals.css` | Add dark-mode body background |

---

## Section 1: Sidebar Navigation

### Layout structure

`layout.tsx` renders a full-height flex row:

```
<html class="h-full">
  <body class="h-full flex bg-gray-50 dark:bg-gray-900">
    <Sidebar />                    ← fixed 240px, hidden on mobile
    <MobileHeader />               ← sticky top bar on mobile only (hamburger + business name)
    <main class="flex-1 overflow-y-auto ml-0 md:ml-60 min-h-screen">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </main>
    <MobileDrawer />               ← overlay sidebar on mobile, toggled by hamburger
  </body>
</html>
```

The `ml-0 md:ml-60` pushes the main content right of the sidebar on desktop.

### Sidebar contents (top → bottom)

1. **Logo area** — business logo + business name (fetched from `businessProfile`)
2. **Nav links** — each link: SVG icon + label; active state: `bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400`
3. **Divider** before admin-only links
4. **Bottom section** — user name + role badge + sign out button + **theme toggle button**

### SVG icons

Each nav link uses a simple inline SVG. No external icon library. Icons are 20×20px strokes:

| Link | Icon |
|---|---|
| Dashboard | Home/house outline |
| Orders | Clipboard list outline |
| Customers | Users outline |
| Payments | Banknotes outline |
| Analytics | Chart bar outline |
| Fabric Stock | Cube outline |
| Settings | Cog/gear outline |
| Users (admin) | User circle outline |
| Activity Log (admin) | Document text outline |

### Mobile behaviour

On screens `< md (768px)`:
- Sidebar is hidden (`hidden md:block`)
- A sticky `MobileHeader` bar shows: hamburger button (left), business name (center), user avatar initial (right)
- Hamburger opens a full-height overlay drawer with the same sidebar content
- Tapping a link or the backdrop closes the drawer

The `Sidebar` component handles both desktop sidebar and the drawer content — a `isMobile` prop controls the wrapper element.

---

## Section 2: Dark Mode

### ThemeProvider

A `'use client'` component that wraps `{children}` in the root layout:

```typescript
'use client';
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  }, []);
  return <>{children}</>;
}
```

### Theme toggle button

In the sidebar bottom section, a moon/sun icon button:

```typescript
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
```

### Tailwind config

In `tailwind.config.ts`, set `darkMode: 'class'` (likely already set or add it).

### Dark mode color additions to `globals.css`

```css
.dark body {
  background-color: rgb(17, 24, 39);   /* gray-900 */
  color: rgb(229, 231, 235);           /* gray-200 */
}
```

### Key dark-mode classes applied throughout

- Cards: `dark:bg-gray-800 dark:border-gray-700`
- Text: `dark:text-gray-100`, `dark:text-gray-400`
- Inputs: `dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100`
- Sidebar: `dark:bg-gray-800 dark:border-gray-700`

---

## Section 3: Reusable UI Components

### `PageHeader`

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;  // right-side slot (e.g. "New Order" button)
}
```

Renders a flex row with `title` (h1, 2xl bold) left, `action` right. Used at the top of every page instead of inline `<h1>` tags.

### `EmptyState`

```typescript
interface EmptyStateProps {
  icon: React.ReactNode;   // SVG icon (40×40)
  title: string;
  body?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}
```

Centered layout: icon → title → body → optional CTA button. Used in list pages when the array is empty.

### `SkeletonList`

```typescript
interface SkeletonListProps {
  rows?: number;   // default 5
  cols?: number;   // default 4 — controls number of placeholder blocks per row
}
```

Renders `rows` skeleton rows with `cols` animated pulse blocks each. Used while list data is loading.

---

## Pages Updated

### `orders/page.tsx` and `customers/page.tsx`

Replace:
- Inline `<h1>` with `<PageHeader title="Orders" action={<Link href="/orders/new">...</Link>} />`
- `{orders.length === 0 && <p>No orders</p>}` with `<EmptyState ...>`
- Inline loading spinner with `<SkeletonList />`

No data model or API changes.

---

## Tailwind Config

Add `darkMode: 'class'` to `tailwind.config.ts` if not already present.

---

## Out of Scope

- Full dashboard stat card redesign
- Recharts dark theme
- Animation/transition overhaul
- Per-page mobile layout audits beyond orders/customers

---

## Verification

1. Desktop: sidebar visible on the left; content area indented 240px
2. Mobile (< 768px): sidebar hidden; mobile header shown; hamburger opens drawer
3. Dark mode: click sun/moon toggle → page goes dark; refresh → dark persists
4. System dark mode: set OS to dark → app opens dark without manual toggle
5. Orders page: empty state renders when no orders; skeleton shows while loading
6. Customers page: same
7. `yarn tsc --noEmit` clean
