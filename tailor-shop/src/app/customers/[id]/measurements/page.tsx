'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MeasurementForm, { Measurement, MeasurementField } from '@/components/MeasurementForm';
import { formatDate } from '@/lib/utils';

type Customer = {
  id: string;
  fullName: string;
};

type DisplayField = {
  name: MeasurementField;
  label: string;
};

const displayFields: DisplayField[] = [
  { name: 'bust', label: 'Bust' },
  { name: 'chest', label: 'Chest' },
  { name: 'waist', label: 'Waist' },
  { name: 'hips', label: 'Hips' },
  { name: 'shoulderWidth', label: 'Shoulder width' },
  { name: 'sleeveLength', label: 'Sleeve length' },
  { name: 'neckCircumference', label: 'Neck circumference' },
  { name: 'armhole', label: 'Armhole' },
  { name: 'bicep', label: 'Bicep' },
  { name: 'inseam', label: 'Inseam' },
  { name: 'outseam', label: 'Outseam' },
  { name: 'thigh', label: 'Thigh' },
  { name: 'knee', label: 'Knee' },
  { name: 'calf', label: 'Calf' },
  { name: 'ankleCircumference', label: 'Ankle circumference' },
  { name: 'height', label: 'Height' },
  { name: 'backLength', label: 'Back length' },
  { name: 'frontLength', label: 'Front length' },
  { name: 'waistToKnee', label: 'Waist to knee' },
  { name: 'waistToFloor', label: 'Waist to floor' },
];

const summaryFields: (DisplayField & { fallbackName?: MeasurementField })[] = [
  { name: 'bust', fallbackName: 'chest', label: 'Bust/chest' },
  { name: 'waist', label: 'Waist' },
  { name: 'hips', label: 'Hips' },
  { name: 'height', label: 'Height' },
  { name: 'inseam', label: 'Inseam' },
  { name: 'sleeveLength', label: 'Sleeve length' },
];

export default function CustomerMeasurementsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [customerResponse, measurementsResponse] = await Promise.all([
        fetch(`/api/customers/${params.id}`),
        fetch(`/api/customers/${params.id}/measurements`),
      ]);

      if (!customerResponse.ok) throw new Error('Customer not found');
      if (!measurementsResponse.ok) throw new Error('Failed to load measurements');

      const customerData = (await customerResponse.json()) as Customer;
      const measurementData = (await measurementsResponse.json()) as Measurement[];
      setCustomer(customerData);
      setMeasurements(measurementData);
    } catch (fetchError: unknown) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load measurements';
      setError(message);
      if (message === 'Customer not found') router.push('/customers');
    } finally {
      setLoading(false);
    }
  };

  const twoMostRecent = useMemo(() => measurements.slice(0, 2), [measurements]);

  const closeForm = () => {
    setShowForm(false);
    setEditingMeasurement(null);
  };

  const handleFormSuccess = (_measurement: Measurement) => {
    closeForm();
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/customers/${params.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Back to customer
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            {customer?.fullName || 'Customer'} measurements
          </h1>
          <p className="mt-1 text-sm text-gray-500">Measurement snapshots newest first</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowCompare((current) => !current)}
            disabled={twoMostRecent.length < 2}
            title={twoMostRecent.length < 2 ? 'Need at least 2 measurements to compare' : undefined}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare latest two
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700"
          >
            Add measurements
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCompare && twoMostRecent.length === 2 && (
        <ComparePanel latest={twoMostRecent[0]} previous={twoMostRecent[1]} />
      )}

      <div className="bg-white rounded-lg shadow">
        {measurements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No measurements recorded yet</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {measurements.map((measurement) => (
              <MeasurementSnapshot
                key={measurement.id}
                measurement={measurement}
                expanded={expandedId === measurement.id}
                onToggle={() =>
                  setExpandedId((current) => (current === measurement.id ? null : measurement.id))
                }
                onEdit={() => {
                  setEditingMeasurement(measurement);
                  setShowForm(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingMeasurement ? 'Edit measurements' : 'Add measurements'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close measurements form"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <MeasurementForm
              customerId={params.id}
              initialData={editingMeasurement || undefined}
              onSuccess={handleFormSuccess}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MeasurementSnapshot({
  measurement,
  expanded,
  onToggle,
  onEdit,
}: {
  measurement: Measurement;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <button type="button" onClick={onToggle} className="flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{formatDate(measurement.takenAt)}</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {measurement.unit}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Taken by {measurement.takenBy || 'Unknown'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summaryFields.map((field) => (
              <MeasurementChip
                key={field.name}
                label={field.label}
                value={measurement[field.name] ?? (field.fallbackName ? measurement[field.fallbackName] : undefined)}
                unit={measurement.unit}
              />
            ))}
          </div>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Edit measurements"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {displayFields.map((field) => (
            <div key={field.name} className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{field.label}</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {formatMeasurement(measurement[field.name], measurement.unit)}
              </div>
            </div>
          ))}
          {measurement.notes && (
            <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2 lg:col-span-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</div>
              <div className="mt-1 text-sm text-gray-900">{measurement.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeasurementChip({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  unit: 'cm' | 'inches';
}) {
  return (
    <span className="rounded-full bg-gray-50 px-3 py-1 text-sm text-gray-700">
      {label}: <span className="font-medium text-gray-900">{formatMeasurement(value, unit)}</span>
    </span>
  );
}

function ComparePanel({
  latest,
  previous,
}: {
  latest: Measurement;
  previous: Measurement;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Compare latest measurements</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4 text-left font-medium text-gray-500">Field</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">{formatDate(latest.takenAt)}</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">{formatDate(previous.takenAt)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayFields.map((field) => {
              const changed = latest[field.name] !== previous[field.name];
              return (
                <tr key={field.name}>
                  <td className="py-2 pr-4 font-medium text-gray-700">{field.label}</td>
                  <td className={`px-4 py-2 ${changed ? 'font-semibold text-amber-700' : 'text-gray-900'}`}>
                    {formatMeasurement(latest[field.name], latest.unit)}
                  </td>
                  <td className={`px-4 py-2 ${changed ? 'font-semibold text-amber-700' : 'text-gray-900'}`}>
                    {formatMeasurement(previous[field.name], previous.unit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMeasurement(value: number | null | undefined, unit: 'cm' | 'inches'): string {
  if (value === null || value === undefined) return '-';
  return `${value} ${unit}`;
}
