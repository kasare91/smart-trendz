# Measurements v2 Design Spec

**Date:** 2026-05-03  
**Status:** Approved

---

## Goal

Extend the existing (complete) Measurements feature with four additions: tenant-isolation fixes, a soft duplicate guard, a measurement timeline chart, a read-only measurements reference panel on order pages, and a downloadable PDF measurement card.

## Architecture

No schema changes. All additions are API-layer fixes and UI enhancements. The measurements API routes were written before Phase 1 multi-tenancy and need the same three-way tenant scoping applied to all other routes. The UI additions (chart, order panel, PDF button) all consume existing API endpoints — no new data model needed.

**Tech Stack:** Next.js 14 App Router, TypeScript strict mode, Prisma 5, Recharts (already in project), `@react-pdf/renderer` (already in project), Tailwind CSS.

---

## File Map

| File | Change |
|---|---|
| `src/app/api/customers/[id]/measurements/route.ts` | Add three-way tenant scoping to GET + POST; add duplicate guard to POST |
| `src/app/api/customers/[id]/measurements/[measurementId]/route.ts` | Add three-way tenant scoping to PATCH + DELETE |
| `src/app/api/customers/[id]/measurements/pdf/route.ts` | NEW — server-side PDF generation via `@react-pdf/renderer` |
| `src/lib/measurement-pdf.tsx` | NEW — `MeasurementCardPDF` React PDF component |
| `src/app/customers/[id]/measurements/page.tsx` | Add `MeasurementChart` component and "Download PDF" button |
| `src/components/MeasurementChart.tsx` | NEW — Recharts `LineChart` with field selector |
| `src/app/orders/new/page.tsx` | Add collapsible measurements reference panel after customer selection |
| `src/app/orders/[id]/page.tsx` | Add collapsible measurements reference panel to order detail |

---

## Section 1: Tenant Scoping + Duplicate Guard

### Tenant Scoping

Both measurements route files apply the old two-way `role !== 'ADMIN'` branch filter from before Phase 1. Replace with the standard three-way pattern used across the rest of the codebase:

```typescript
if (user.role === 'SUPER_ADMIN') {
  // unrestricted
} else if (user.role === 'ADMIN') {
  // verify customer.branch.tenantId === user.tenantId
} else {
  // verify customer.branchId === user.branchId
}
```

For the collection route (`route.ts` GET), scope the customer lookup via `branch: { tenantId: user.tenantId }` when role is ADMIN.

For `[measurementId]` routes (PATCH, DELETE), fetch the measurement's parent customer with `include: { branch: { select: { tenantId: true } } }` and enforce the three-way check before mutating.

### Duplicate Guard (POST)

Before inserting a new measurement, query for an existing one on the same calendar day:

```typescript
const startOfDay = new Date(takenAt);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(takenAt);
endOfDay.setHours(23, 59, 59, 999);

const existing = await prisma.measurement.findFirst({
  where: {
    customerId: params.id,
    takenAt: { gte: startOfDay, lte: endOfDay },
  },
  select: { id: true },
});

if (existing && !override) {
  return NextResponse.json(
    { conflict: true, existingId: existing.id },
    { status: 409 }
  );
}
```

The `override` flag comes from the `?override=true` query param. The frontend `MeasurementForm` component:

1. Catches a `409` response with `{ conflict: true }`.
2. Shows a confirm dialog: "A measurement was already recorded today. Save anyway?"
3. On confirm, resends the same POST with `?override=true` appended to the URL.

---

## Section 2: Timeline Chart

### Component: `src/components/MeasurementChart.tsx`

A `'use client'` component that receives the full `measurements` array (already fetched by the page) as a prop. No additional fetch.

**Props:**
```typescript
interface MeasurementChartProps {
  measurements: Measurement[];
  unit: string; // "cm" or "inches" — for Y-axis label
}
```

**Behaviour:**
- Renders nothing (returns `null`) when `measurements.length < 2`. The parent page shows a "Take at least 2 measurements to see trends" placeholder in the chart area.
- A `<select>` dropdown lets the user pick the field to chart. Options are populated from `measurementFields` (from `src/types/measurements.ts`), filtered to fields where at least one snapshot has a non-null value.
- Default field: `waist` if recorded; otherwise the first field with any data.
- X-axis: `takenAt` formatted as `"DD MMM"` via `date-fns`.
- Y-axis: numeric value in the current unit.
- Tooltip shows the exact value and full date.
- Line is `stroke="#6366f1"` (indigo, consistent with the app's accent colour).

**Recharts structure:**
```tsx
<ResponsiveContainer width="100%" height={240}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis unit={` ${unit}`} />
    <Tooltip />
    <Line type="monotone" dataKey="value" stroke="#6366f1" dot={{ r: 4 }} />
  </LineChart>
</ResponsiveContainer>
```

### Integration in `measurements/page.tsx`

Add `MeasurementChart` above the snapshots list, passing the already-fetched `measurements` array. Add a "Download PDF" button next to the existing "Add measurements" button — links to `/api/customers/[id]/measurements/pdf`.

---

## Section 3: Measurements Reference Panel on Orders

### Behaviour

A collapsible panel labelled "Customer Measurements" appears:
- On `/orders/new` — after a customer is selected from the dropdown, a `fetch('/api/customers/{id}/measurements')` retrieves the list. The panel renders `measurements[0]` (newest first).
- On `/orders/[id]` — fetched alongside the order data on page load using the order's `customerId`.

**Panel content when expanded:**
- Six-field summary: bust/chest, waist, hips, height, inseam, sleeve length (matching the summary shown on the measurements page itself).
- "Taken on: {date}" and "By: {takenBy}" metadata.
- "View all measurements →" link to `/customers/[id]/measurements`.

**Panel states:**
- **Loading:** Spinner while fetch is in flight.
- **No measurements:** "No measurements recorded yet. [Add measurements →]" link.
- **Has data:** Collapsed by default. Toggle via a chevron button showing/hiding the six-field grid.

### Implementation

Both order pages are `'use client'` components. Add a `useState` for `latestMeasurement` and a `useEffect` (in `orders/new`) or fetch alongside existing data (in `orders/[id]`) to populate it. No new API route — reuses `GET /api/customers/[id]/measurements`.

---

## Section 4: PDF Export

### Route: `GET /api/customers/[id]/measurements/pdf`

Follows the exact same pattern as `GET /api/orders/[id]/receipt`.

**Auth:** `requireAuth()` + same three-way tenant/branch access check as the GET measurements route.

**Data fetched:**
- All measurements for the customer (ordered by `takenAt` desc).
- Customer record (name, phone, email).
- Business profile (name, logo, currency, footer note) via `getBusinessProfile(user.tenantId)`.

**Response:**
```typescript
const buffer = await renderToBuffer(<MeasurementCardPDF {...props} />);
return new NextResponse(buffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="measurements-${slugifiedName}.pdf"`,
  },
});
```

### Component: `src/lib/measurement-pdf.tsx`

A `@react-pdf/renderer` component modelled on the existing `receipt-pdf.tsx`.

**Layout:**
1. **Header** — business logo (if set) + business name, right-aligned "Measurement Card" title.
2. **Customer info** — name, phone, email in a two-column row.
3. **Measurement snapshot(s)** — for each measurement (newest first):
   - "Taken: {date} by {takenBy}" subtitle.
   - Three sections (Upper Body, Lower Body, Full Body) rendered as two-column label/value grids. Blank fields (null) are omitted entirely.
   - Notes block (if any).
4. **Footer** — `receiptFooterNote` from BusinessProfile, page number.

**Props:**
```typescript
interface MeasurementCardPDFProps {
  customer: { fullName: string; phoneNumber: string; email: string | null };
  measurements: Measurement[];
  businessProfile: BusinessProfile | null;
}
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Duplicate measurement, no override | `409 { conflict: true, existingId }` → frontend confirm dialog |
| Duplicate measurement, override=true | Insert proceeds normally |
| Cross-tenant access attempt | `403 ForbiddenError` (consistent with Phase 1 pattern) |
| Customer has no measurements (PDF) | Return `404` with `{ error: 'No measurements found' }` |
| PDF render error | Return `500` via `handleApiError` |
| No measurements for chart | `MeasurementChart` renders null; page shows placeholder text |

---

## Out of Scope

- Size recommendation system (suggest clothing size from measurements)
- Bulk CSV import of measurements
- Interactive measurement diagram (SVG annotations)
- Measurement templates (saved presets)
- Measurement-to-order hard linkage (snapshot stored on Order row) — deferred per user decision

---

## Verification

1. **Tenant scoping** — log in as ADMIN for Tenant A, attempt `GET /api/customers/{tenantB-customer-id}/measurements` → 403
2. **Duplicate guard** — POST measurement for a customer, POST again same day → 409 conflict response; confirm override → 201 success
3. **Chart** — add 2+ measurements to a customer, navigate to measurements page → chart renders with field selector
4. **Order panel** — create order for customer with measurements → panel appears collapsed; expand → shows 6-field summary
5. **PDF** — click "Download PDF" on measurements page → PDF downloads with customer name, measurement fields, business branding
6. **TypeScript** — `yarn tsc --noEmit` passes clean
