# Measurements v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Measurements feature with tenant-isolation fixes, a soft duplicate guard, a timeline chart, a measurements reference panel on order pages, and a downloadable PDF measurement card.

**Architecture:** No schema changes. All changes are API-layer fixes (replacing the old two-way branch filter with the standard three-way SUPER_ADMIN/ADMIN/STAFF pattern) and UI additions (Recharts chart, collapsible order panel, PDF button + route). Every new UI piece consumes existing API endpoints.

**Tech Stack:** Next.js 14 App Router, TypeScript strict mode, Prisma 5, Recharts (already in project), `@react-pdf/renderer` (already in project), Tailwind CSS, date-fns.

---

## File Map

| File | Change |
|---|---|
| `src/app/api/customers/[id]/measurements/route.ts` | Replace `getAccessibleCustomer` helper with three-way tenant scoping; add duplicate guard to POST |
| `src/app/api/customers/[id]/measurements/[measurementId]/route.ts` | Fix PATCH two-way → three-way; add DELETE cross-tenant guard; update `getMeasurementForCustomer` to include `branch.tenantId` |
| `src/components/MeasurementForm.tsx` | Handle 409 conflict → confirm dialog → retry with `?override=true` |
| `src/components/MeasurementChart.tsx` | NEW — Recharts `LineChart` with field selector |
| `src/app/customers/[id]/measurements/page.tsx` | Add `MeasurementChart` above snapshots list; add "Download PDF" button |
| `src/app/orders/new/page.tsx` | Add collapsible measurements panel after customer selection |
| `src/app/orders/[id]/page.tsx` | Add collapsible measurements panel |
| `src/lib/measurement-pdf.tsx` | NEW — `MeasurementCardPDF` component (`@react-pdf/renderer`) |
| `src/app/api/customers/[id]/measurements/pdf/route.ts` | NEW — server-side PDF generation |

---

## Task 1: Tenant Scoping + Duplicate Guard

**Files:**
- Modify: `src/app/api/customers/[id]/measurements/route.ts`
- Modify: `src/app/api/customers/[id]/measurements/[measurementId]/route.ts`
- Modify: `src/components/MeasurementForm.tsx`

- [ ] **Step 1: Replace the two-way `getAccessibleCustomer` helper in the collection route with three-way scoping**

Open `src/app/api/customers/[id]/measurements/route.ts`. Replace the entire `getAccessibleCustomer` function (lines 60–79) and update both callers.

Replace:
```typescript
async function getAccessibleCustomer(customerId: string, userRole: string, userBranchId: string | null) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      fullName: true,
      branchId: true,
    },
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  if (userRole !== 'ADMIN' && customer.branchId !== userBranchId) {
    throw new ForbiddenError('Customer not found');
  }

  return customer;
}
```

With:
```typescript
async function getAccessibleCustomer(customerId: string, user: { role: string; tenantId: string | null; branchId: string | null }) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      fullName: true,
      branchId: true,
      branch: { select: { tenantId: true } },
    },
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  if (user.role === 'SUPER_ADMIN') {
    // unrestricted
  } else if (user.role === 'ADMIN') {
    if (customer.branch.tenantId !== user.tenantId) {
      throw new ForbiddenError('Customer not found');
    }
  } else if (customer.branchId !== user.branchId) {
    throw new ForbiddenError('Customer not found');
  }

  return customer;
}
```

- [ ] **Step 2: Update the two callers of `getAccessibleCustomer` to pass `user` instead of individual fields**

In `GET`:
```typescript
// Before
await getAccessibleCustomer(params.id, user.role, user.branchId);

// After
await getAccessibleCustomer(params.id, user);
```

In `POST`:
```typescript
// Before
const customer = await getAccessibleCustomer(params.id, user.role, user.branchId);

// After
const customer = await getAccessibleCustomer(params.id, user);
```

- [ ] **Step 3: Add the duplicate guard to the POST handler in the collection route**

In the `POST` handler, after `const customer = await getAccessibleCustomer(params.id, user);` and before the `prisma.measurement.create` call, insert:

```typescript
const searchParams = request.nextUrl.searchParams;
const override = searchParams.get('override') === 'true';

const takenAtRaw = body.takenAt ? new Date(body.takenAt) : new Date();
const startOfDay = new Date(takenAtRaw);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(takenAtRaw);
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

Also add `body` variable declaration before the duplicate guard (move it from later in the function):
```typescript
const body = (await request.json()) as MeasurementBody;
```

The full POST handler after the change should look like:
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(['ADMIN', 'STAFF']);
    const customer = await getAccessibleCustomer(params.id, user);
    const body = (await request.json()) as MeasurementBody;

    const searchParams = request.nextUrl.searchParams;
    const override = searchParams.get('override') === 'true';

    const takenAtRaw = body.takenAt ? new Date(body.takenAt) : new Date();
    const startOfDay = new Date(takenAtRaw);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(takenAtRaw);
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

    const measurement = await prisma.measurement.create({
      data: {
        customerId: params.id,
        takenBy: user.name,
        ...parseMeasurementData(body),
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: customer.branchId,
      action: 'CREATE',
      entity: 'MEASUREMENT',
      entityId: measurement.id,
      description: `Recorded measurements for ${customer.fullName}`,
      metadata: {
        customerId: customer.id,
        takenAt: measurement.takenAt.toISOString(),
      },
    });

    return NextResponse.json(measurement, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating measurement:');
  }
}
```

- [ ] **Step 4: Fix the `[measurementId]` route — update `getMeasurementForCustomer` to include `branch.tenantId`**

Open `src/app/api/customers/[id]/measurements/[measurementId]/route.ts`. In `getMeasurementForCustomer`, change the `customer` select from:
```typescript
customer: {
  select: {
    id: true,
    fullName: true,
    branchId: true,
  },
},
```
To:
```typescript
customer: {
  select: {
    id: true,
    fullName: true,
    branchId: true,
    branch: { select: { tenantId: true } },
  },
},
```

- [ ] **Step 5: Fix PATCH — replace two-way check with three-way**

In the `PATCH` handler, replace:
```typescript
if (user.role !== 'ADMIN' && existingMeasurement.customer.branchId !== user.branchId) {
  throw new ForbiddenError('Measurement not found');
}
```

With:
```typescript
if (user.role === 'SUPER_ADMIN') {
  // unrestricted
} else if (user.role === 'ADMIN') {
  if (existingMeasurement.customer.branch.tenantId !== user.tenantId) {
    throw new ForbiddenError('Measurement not found');
  }
} else if (existingMeasurement.customer.branchId !== user.branchId) {
  throw new ForbiddenError('Measurement not found');
}
```

- [ ] **Step 6: Fix DELETE — add cross-tenant guard**

In the `DELETE` handler, after `const existingMeasurement = await getMeasurementForCustomer(params.id, params.measurementId);`, add:

```typescript
if (user.role === 'SUPER_ADMIN') {
  // unrestricted
} else if (existingMeasurement.customer.branch.tenantId !== user.tenantId) {
  throw new ForbiddenError('Measurement not found');
}
```

- [ ] **Step 7: Add 409 conflict handling and confirm dialog to `MeasurementForm`**

Open `src/components/MeasurementForm.tsx`. Add a `showConflict` state and `pendingPayload` ref, then update `handleSubmit` to intercept 409 responses:

Add new state at the top of the component (after existing `useState` calls):
```typescript
const [showConflict, setShowConflict] = useState(false);
const [pendingPayloadRef, setPendingPayloadRef] = useState<Record<string, string | number | null> | null>(null);
```

Replace the `handleSubmit` function with:
```typescript
const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  await doSubmit(false);
};

const doSubmit = async (override: boolean) => {
  setLoading(true);
  setError('');
  setSuccess('');

  const payload: Record<string, string | number | null> = {
    unit,
    takenAt,
    notes: notes.trim() || null,
  };

  for (const [key, value] of Object.entries(values)) {
    payload[key] = value === '' ? null : Number(value);
  }

  if (override) {
    setPendingPayloadRef(null);
    setShowConflict(false);
  }

  try {
    const base = initialData?.id
      ? `/api/customers/${customerId}/measurements/${initialData.id}`
      : `/api/customers/${customerId}/measurements`;
    const url = override ? `${base}?override=true` : base;

    const response = await fetch(url, {
      method: initialData?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 409) {
      const data = (await response.json()) as { conflict?: boolean };
      if (data.conflict) {
        setPendingPayloadRef(payload);
        setShowConflict(true);
        setLoading(false);
        return;
      }
    }

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error || 'Failed to save measurements');
    }

    const measurement = (await response.json()) as Measurement;
    setSuccess('Measurements saved.');
    onSuccess(measurement);
  } catch (submitError: unknown) {
    setError(submitError instanceof Error ? submitError.message : 'Failed to save measurements');
  } finally {
    setLoading(false);
  }
};
```

Add the conflict dialog just before the closing `</form>` tag (after the submit button `</div>`):
```tsx
{showConflict && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-gray-900">Duplicate measurement</h3>
      <p className="mt-2 text-sm text-gray-600">
        A measurement was already recorded today. Save anyway?
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => { setShowConflict(false); setPendingPayloadRef(null); }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => doSubmit(true)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Save anyway
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 8: Verify tenant scoping manually**

Run the dev server (`yarn dev` from `tailor-shop/`). Log in as an ADMIN for one tenant. In the browser, attempt `GET /api/customers/{customer-from-other-tenant}/measurements` — expect 403. Confirm a measurement for a same-tenant customer returns 200.

- [ ] **Step 9: Verify duplicate guard manually**

POST a measurement for any customer. POST again with the same `takenAt` date — expect `409 { conflict: true }` in the network response. Clicking "Save anyway" in the form should resend with `?override=true` and get 201.

- [ ] **Step 10: Commit**

```bash
git add tailor-shop/src/app/api/customers/\[id\]/measurements/route.ts \
        tailor-shop/src/app/api/customers/\[id\]/measurements/\[measurementId\]/route.ts \
        tailor-shop/src/components/MeasurementForm.tsx
git commit -m "feat: measurements v2 — tenant scoping + duplicate guard"
```

---

## Task 2: MeasurementChart + PDF Button

**Files:**
- Create: `src/components/MeasurementChart.tsx`
- Modify: `src/app/customers/[id]/measurements/page.tsx`

- [ ] **Step 1: Create `MeasurementChart.tsx`**

Create `tailor-shop/src/components/MeasurementChart.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { Measurement } from '@/components/MeasurementForm';
import { MeasurementField, measurementFields } from '@/types/measurements';

const fieldLabels: Record<MeasurementField, string> = {
  bust: 'Bust',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  shoulderWidth: 'Shoulder width',
  sleeveLength: 'Sleeve length',
  neckCircumference: 'Neck circumference',
  armhole: 'Armhole',
  bicep: 'Bicep',
  inseam: 'Inseam',
  outseam: 'Outseam',
  thigh: 'Thigh',
  knee: 'Knee',
  calf: 'Calf',
  ankleCircumference: 'Ankle circumference',
  height: 'Height',
  backLength: 'Back length',
  frontLength: 'Front length',
  waistToKnee: 'Waist to knee',
  waistToFloor: 'Waist to floor',
};

interface MeasurementChartProps {
  measurements: Measurement[];
  unit: string;
}

export default function MeasurementChart({ measurements, unit }: MeasurementChartProps) {
  const fieldsWithData = measurementFields.filter((f) =>
    measurements.some((m) => m[f] != null)
  );

  const defaultField: MeasurementField =
    fieldsWithData.includes('waist') ? 'waist' : fieldsWithData[0];

  const [selectedField, setSelectedField] = useState<MeasurementField>(defaultField);

  if (measurements.length < 2) return null;

  const chartData = [...measurements]
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime())
    .map((m) => ({
      date: format(new Date(m.takenAt), 'dd MMM'),
      fullDate: format(new Date(m.takenAt), 'dd MMM yyyy'),
      value: m[selectedField] ?? null,
    }))
    .filter((d) => d.value !== null);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Measurement trend</h2>
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value as MeasurementField)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
        >
          {fieldsWithData.map((f) => (
            <option key={f} value={f}>
              {fieldLabels[f]}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis unit={` ${unit}`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [`${value} ${unit}`, fieldLabels[selectedField]]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate ?? label}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Integrate `MeasurementChart` and add PDF button into the measurements page**

Open `src/app/customers/[id]/measurements/page.tsx`.

Add the import at the top:
```tsx
import MeasurementChart from '@/components/MeasurementChart';
```

In the `buttons` div (the flex wrapper containing "Compare latest two" and "Add measurements"), add the PDF download button between the two existing buttons:
```tsx
<a
  href={`/api/customers/${params.id}/measurements/pdf`}
  target="_blank"
  rel="noreferrer"
  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
>
  Download PDF
</a>
```

Immediately before the `<div className="bg-white rounded-lg shadow">` that wraps the snapshots list, insert the chart and its placeholder:

```tsx
{measurements.length >= 2 ? (
  <MeasurementChart
    measurements={measurements}
    unit={measurements[0]?.unit || 'cm'}
  />
) : measurements.length > 0 ? (
  <div className="rounded-lg bg-white p-6 shadow">
    <p className="text-sm text-gray-500">Take at least 2 measurements to see trends.</p>
  </div>
) : null}
```

- [ ] **Step 3: Verify chart renders**

Run `yarn dev`. Navigate to a customer with 2+ measurements. Confirm the chart appears above the snapshots with the field selector. Change the selector — the line should update. With only 1 measurement, the placeholder text appears instead of the chart. With 0 measurements, neither appears.

- [ ] **Step 4: Commit**

```bash
git add tailor-shop/src/components/MeasurementChart.tsx \
        tailor-shop/src/app/customers/\[id\]/measurements/page.tsx
git commit -m "feat: measurements v2 — timeline chart + download PDF button"
```

---

## Task 3: Measurements Reference Panel on Order Pages

**Files:**
- Modify: `src/app/orders/new/page.tsx`
- Modify: `src/app/orders/[id]/page.tsx`

- [ ] **Step 1: Add the `LatestMeasurementPanel` component to a shared location**

Create `tailor-shop/src/components/LatestMeasurementPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Measurement } from '@/components/MeasurementForm';

type SummaryField = {
  label: string;
  primary: keyof Measurement;
  fallback?: keyof Measurement;
};

const summaryFields: SummaryField[] = [
  { label: 'Bust/chest', primary: 'bust', fallback: 'chest' },
  { label: 'Waist', primary: 'waist' },
  { label: 'Hips', primary: 'hips' },
  { label: 'Height', primary: 'height' },
  { label: 'Inseam', primary: 'inseam' },
  { label: 'Sleeve length', primary: 'sleeveLength' },
];

interface LatestMeasurementPanelProps {
  customerId: string;
}

export default function LatestMeasurementPanel({ customerId }: LatestMeasurementPanelProps) {
  const [measurement, setMeasurement] = useState<Measurement | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setMeasurement(undefined);
      return;
    }

    setMeasurement(undefined);
    fetch(`/api/customers/${customerId}/measurements`)
      .then((res) => (res.ok ? (res.json() as Promise<Measurement[]>) : Promise.resolve([])))
      .then((data) => setMeasurement(data[0] ?? null))
      .catch(() => setMeasurement(null));
  }, [customerId]);

  if (!customerId) return null;

  if (measurement === undefined) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading measurements…
        </div>
      </div>
    );
  }

  if (measurement === null) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        No measurements recorded yet.{' '}
        <Link
          href={`/customers/${customerId}/measurements`}
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Add measurements →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <span className="text-sm font-medium text-gray-900">Customer measurements</span>
          <span className="ml-2 text-xs text-gray-500">
            Taken {format(new Date(measurement.takenAt), 'dd MMM yyyy')}
            {measurement.takenBy ? ` by ${measurement.takenBy}` : ''}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {summaryFields.map((f) => {
              const value =
                (measurement[f.primary] as number | null | undefined) ??
                (f.fallback ? (measurement[f.fallback] as number | null | undefined) : undefined);
              return (
                <div key={String(f.primary)} className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {f.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {value != null ? `${value} ${measurement.unit}` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <Link
              href={`/customers/${customerId}/measurements`}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all measurements →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the panel to `orders/new/page.tsx`**

Open `src/app/orders/new/page.tsx`. Add the import:
```tsx
import LatestMeasurementPanel from '@/components/LatestMeasurementPanel';
```

Find where `customerId` state is set from the customer dropdown selector. The existing dropdown for selecting an existing customer is likely a `<select>` that calls `setCustomerId`. Immediately after the customer selection section (the block containing the "Select existing customer" dropdown or the "Create new customer" toggle), add:

```tsx
{customerId && !showNewCustomer && (
  <LatestMeasurementPanel customerId={customerId} />
)}
```

- [ ] **Step 3: Add the panel to `orders/[id]/page.tsx`**

Open `src/app/orders/[id]/page.tsx`. Add the import:
```tsx
import LatestMeasurementPanel from '@/components/LatestMeasurementPanel';
```

In the JSX, find an appropriate location in the order detail layout — after the customer info section and before the payments section. Add:

```tsx
{order.customerId && (
  <LatestMeasurementPanel customerId={order.customerId} />
)}
```

- [ ] **Step 4: Verify panels in the browser**

Run `yarn dev`. 
- Go to `/orders/new`, select a customer with measurements — the panel should appear with a spinner, then render collapsed. Expand it and confirm the 6-field summary + "View all measurements →" link. 
- Select a customer with no measurements — panel shows "No measurements recorded yet."
- Navigate to `/orders/{id}` for an order whose customer has measurements — panel appears.

- [ ] **Step 5: Commit**

```bash
git add tailor-shop/src/components/LatestMeasurementPanel.tsx \
        tailor-shop/src/app/orders/new/page.tsx \
        tailor-shop/src/app/orders/\[id\]/page.tsx
git commit -m "feat: measurements v2 — collapsible reference panel on order pages"
```

---

## Task 4: PDF Export

**Files:**
- Create: `src/lib/measurement-pdf.tsx`
- Create: `src/app/api/customers/[id]/measurements/pdf/route.ts`

- [ ] **Step 1: Create the `MeasurementCardPDF` component**

Create `tailor-shop/src/lib/measurement-pdf.tsx`:

```tsx
import React from 'react';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { BusinessProfile } from '@prisma/client';
import { DEFAULT_BUSINESS_NAME } from '@/lib/business-profile';
import { Measurement } from '@/components/MeasurementForm';

export interface MeasurementCardPDFProps {
  customer: { fullName: string; phoneNumber: string; email: string | null };
  measurements: Measurement[];
  businessProfile: BusinessProfile | null;
}

type SectionDef = { title: string; fields: { key: keyof Measurement; label: string }[] };

const pdfSections: SectionDef[] = [
  {
    title: 'Upper Body',
    fields: [
      { key: 'bust', label: 'Bust' },
      { key: 'chest', label: 'Chest' },
      { key: 'waist', label: 'Waist' },
      { key: 'hips', label: 'Hips' },
      { key: 'shoulderWidth', label: 'Shoulder width' },
      { key: 'sleeveLength', label: 'Sleeve length' },
      { key: 'neckCircumference', label: 'Neck circumference' },
      { key: 'armhole', label: 'Armhole' },
      { key: 'bicep', label: 'Bicep' },
    ],
  },
  {
    title: 'Lower Body',
    fields: [
      { key: 'inseam', label: 'Inseam' },
      { key: 'outseam', label: 'Outseam' },
      { key: 'thigh', label: 'Thigh' },
      { key: 'knee', label: 'Knee' },
      { key: 'calf', label: 'Calf' },
      { key: 'ankleCircumference', label: 'Ankle circumference' },
    ],
  },
  {
    title: 'Full Body',
    fields: [
      { key: 'height', label: 'Height' },
      { key: 'backLength', label: 'Back length' },
      { key: 'frontLength', label: 'Front length' },
      { key: 'waistToKnee', label: 'Waist to knee' },
      { key: 'waistToFloor', label: 'Waist to floor' },
    ],
  },
];

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr));
}

function getAddress(profile: BusinessProfile | null): string {
  return [profile?.address, profile?.city, profile?.country].filter(Boolean).join(', ');
}

export function MeasurementCardPDF({ customer, measurements, businessProfile }: MeasurementCardPDFProps) {
  const brandColor = businessProfile?.brandColor || '#0ea5e9';
  const businessName = businessProfile?.businessName || DEFAULT_BUSINESS_NAME;
  const address = getAddress(businessProfile);
  const styles = createStyles(brandColor);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.businessBlock}>
            {businessProfile?.logoUrl ? (
              <Image src={businessProfile.logoUrl} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.businessName}>{businessName}</Text>
              {address ? <Text style={styles.headerMutedText}>{address}</Text> : null}
              {businessProfile?.phoneNumber ? (
                <Text style={styles.headerMutedText}>{businessProfile.phoneNumber}</Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.cardTitle}>MEASUREMENT CARD</Text>
        </View>

        <View style={styles.divider} />

        {/* Customer info */}
        <View style={styles.twoColumn}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text style={styles.bodyText}>{customer.fullName}</Text>
            <Text style={styles.bodyText}>{customer.phoneNumber}</Text>
            {customer.email ? <Text style={styles.bodyText}>{customer.email}</Text> : null}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.bodyText}>{measurements.length} snapshot{measurements.length !== 1 ? 's' : ''}</Text>
            {measurements[0] ? (
              <Text style={styles.bodyText}>Latest: {formatDate(measurements[0].takenAt)}</Text>
            ) : null}
          </View>
        </View>

        {/* Measurement snapshots */}
        {measurements.map((m, index) => (
          <View key={m.id} style={index > 0 ? styles.snapshotWithBorder : styles.snapshot}>
            <Text style={styles.snapshotHeader}>
              Taken: {formatDate(m.takenAt)}{m.takenBy ? `  ·  By: ${m.takenBy}` : ''}
              {'  ·  '}{m.unit}
            </Text>
            {pdfSections.map((section) => {
              const presentFields = section.fields.filter(
                (f) => m[f.key] != null
              );
              if (presentFields.length === 0) return null;
              return (
                <View key={section.title} style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={styles.fieldGrid}>
                    {presentFields.map((f) => (
                      <View key={String(f.key)} style={styles.fieldItem}>
                        <Text style={styles.fieldLabel}>{f.label}</Text>
                        <Text style={styles.fieldValue}>{m[f.key] as number} {m.unit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {m.notes ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.bodyText}>{m.notes}</Text>
              </View>
            ) : null}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          {businessProfile?.receiptFooterNote ? (
            <Text style={styles.footerNote}>{businessProfile.receiptFooterNote}</Text>
          ) : null}
          <Text style={styles.mutedText}>
            Generated {new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function createStyles(brandColor: string) {
  return StyleSheet.create({
    page: {
      padding: 36,
      fontFamily: 'Helvetica',
      color: '#111827',
      fontSize: 10,
    },
    header: {
      backgroundColor: brandColor,
      color: '#ffffff',
      padding: 16,
      borderRadius: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    businessBlock: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    logo: {
      width: 52,
      height: 52,
      objectFit: 'contain',
    },
    businessName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#ffffff',
      marginTop: 4,
    },
    headerMutedText: {
      color: '#e0f2fe',
      lineHeight: 1.5,
    },
    mutedText: {
      color: '#6b7280',
      lineHeight: 1.5,
    },
    divider: {
      marginVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    twoColumn: {
      flexDirection: 'row',
      gap: 24,
      marginBottom: 16,
    },
    section: {
      flexGrow: 1,
      flexBasis: 0,
    },
    sectionBlock: {
      marginTop: 10,
    },
    sectionTitle: {
      color: brandColor,
      fontSize: 9,
      fontWeight: 'bold',
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    bodyText: {
      marginBottom: 3,
      lineHeight: 1.45,
    },
    snapshot: {
      marginTop: 8,
    },
    snapshotWithBorder: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      paddingTop: 12,
    },
    snapshotHeader: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#374151',
      marginBottom: 4,
    },
    fieldGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    fieldItem: {
      width: '30%',
      backgroundColor: '#f9fafb',
      padding: 5,
      borderRadius: 3,
    },
    fieldLabel: {
      fontSize: 8,
      color: '#6b7280',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    fieldValue: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#111827',
    },
    footer: {
      position: 'absolute',
      left: 36,
      right: 36,
      bottom: 28,
      textAlign: 'center',
    },
    footerNote: {
      marginBottom: 4,
      color: '#374151',
    },
  });
}

export default MeasurementCardPDF;
```

- [ ] **Step 2: Create the PDF API route**

Create directory: `tailor-shop/src/app/api/customers/[id]/measurements/pdf/`

Create `tailor-shop/src/app/api/customers/[id]/measurements/pdf/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import React from 'react';
import { DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ForbiddenError, NotFoundError, handleApiError } from '@/lib/errors';
import { getBusinessProfile } from '@/lib/business-profile';
import { MeasurementCardPDF } from '@/lib/measurement-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        branchId: true,
        branch: { select: { tenantId: true } },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    if (user.role === 'SUPER_ADMIN') {
      // unrestricted
    } else if (user.role === 'ADMIN') {
      if (customer.branch.tenantId !== user.tenantId) {
        throw new ForbiddenError('Customer not found');
      }
    } else if (customer.branchId !== user.branchId) {
      throw new ForbiddenError('Customer not found');
    }

    const measurements = await prisma.measurement.findMany({
      where: { customerId: params.id },
      orderBy: { takenAt: 'desc' },
    });

    if (measurements.length === 0) {
      return new Response(JSON.stringify({ error: 'No measurements found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const businessProfile = await getBusinessProfile(user.tenantId);

    const slugifiedName = customer.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Cast is safe: MeasurementCardPDF renders a <Document> root
    const document = React.createElement(MeasurementCardPDF, {
      customer,
      measurements: measurements as Parameters<typeof MeasurementCardPDF>[0]['measurements'],
      businessProfile,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(document);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="measurements-${slugifiedName}.pdf"`,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, 'Error generating measurements PDF:');
  }
}
```

- [ ] **Step 3: Verify PDF generation**

Run `yarn dev`. Navigate to a customer with measurements. Click "Download PDF" — the browser should download a PDF file named `measurements-{customer-name}.pdf`. Open it and verify: business header (logo/name if configured), customer info block, measurement snapshots with field grids, footer note.

With a customer that has no measurements, hitting the URL directly should return a 404 JSON response.

- [ ] **Step 4: TypeScript check**

Run from `tailor-shop/`:
```bash
yarn tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add tailor-shop/src/lib/measurement-pdf.tsx \
        tailor-shop/src/app/api/customers/\[id\]/measurements/pdf/route.ts
git commit -m "feat: measurements v2 — PDF export route and component"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - Tenant scoping fix: Task 1 Steps 1–6 ✓
  - Duplicate guard + frontend confirm dialog: Task 1 Steps 3 + 7 ✓
  - MeasurementChart with field selector: Task 2 Step 1 ✓
  - PDF button + page integration: Task 2 Step 2 ✓
  - Order reference panel (new + detail): Task 3 ✓
  - PDF route + MeasurementCardPDF component: Task 4 ✓
  - Three-way SUPER_ADMIN/ADMIN/STAFF pattern used throughout ✓
  - 409 conflict response structure `{ conflict: true, existingId }`: Task 1 Step 3 ✓
  - `?override=true` resend: Task 1 Step 7 ✓
  - Chart returns null when < 2 measurements: Task 2 Step 1 ✓
  - Default chart field is `waist` (or first with data): Task 2 Step 1 ✓

- [x] **No placeholders** — all steps contain complete code

- [x] **Type consistency**
  - `user` object: `{ role, tenantId, branchId, id, name }` from `requireAuth()` / `requireRole()` — consistent throughout
  - `Measurement` type imported from `@/components/MeasurementForm` — used in chart, panel, and PDF component
  - `getMeasurementForCustomer` now returns object with `customer.branch.tenantId` — both PATCH and DELETE access this field

- [x] **Error scenario coverage** (per spec)
  - Duplicate, no override → 409 + confirm dialog ✓
  - Duplicate, override → insert proceeds ✓
  - Cross-tenant access → 403 ForbiddenError ✓
  - Customer has no measurements (PDF) → 404 ✓
  - PDF render error → 500 via `handleApiError` ✓
  - No measurements for chart → null + placeholder text ✓
