'use client';

import { useState } from 'react';
import { MeasurementField } from '@/types/measurements';

export type { MeasurementField };

export type MeasurementFormData = Partial<Record<MeasurementField, number | null>> & {
  id?: string;
  customerId?: string;
  takenAt?: string | Date;
  takenBy?: string | null;
  unit?: 'cm' | 'inches';
  notes?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type Measurement = MeasurementFormData & {
  id: string;
  customerId: string;
  takenAt: string;
  takenBy: string | null;
  unit: 'cm' | 'inches';
  createdAt: string;
  updatedAt: string;
};

type MeasurementFormProps = {
  customerId: string;
  onSuccess: (measurement: Measurement) => void;
  initialData?: Partial<Measurement>;
};

type FieldConfig = {
  name: MeasurementField;
  label: string;
};

const sections: { title: string; fields: FieldConfig[] }[] = [
  {
    title: 'Upper body',
    fields: [
      { name: 'bust', label: 'Bust' },
      { name: 'chest', label: 'Chest' },
      { name: 'waist', label: 'Waist' },
      { name: 'hips', label: 'Hips' },
      { name: 'shoulderWidth', label: 'Shoulder width' },
      { name: 'sleeveLength', label: 'Sleeve length' },
      { name: 'neckCircumference', label: 'Neck circumference' },
      { name: 'armhole', label: 'Armhole' },
      { name: 'bicep', label: 'Bicep' },
    ],
  },
  {
    title: 'Lower body',
    fields: [
      { name: 'inseam', label: 'Inseam' },
      { name: 'outseam', label: 'Outseam' },
      { name: 'thigh', label: 'Thigh' },
      { name: 'knee', label: 'Knee' },
      { name: 'calf', label: 'Calf' },
      { name: 'ankleCircumference', label: 'Ankle circumference' },
    ],
  },
  {
    title: 'Full body',
    fields: [
      { name: 'height', label: 'Height' },
      { name: 'backLength', label: 'Back length' },
      { name: 'frontLength', label: 'Front length' },
      { name: 'waistToKnee', label: 'Waist to knee' },
      { name: 'waistToFloor', label: 'Waist to floor' },
    ],
  },
];

function formatDateInput(value?: string | Date): string {
  if (!value) return new Date().toISOString().split('T')[0];
  return new Date(value).toISOString().split('T')[0];
}

function buildInitialValues(initialData?: MeasurementFormData): Record<MeasurementField, string> {
  const values = {} as Record<MeasurementField, string>;
  for (const section of sections) {
    for (const field of section.fields) {
      const value = initialData?.[field.name];
      values[field.name] = value === null || value === undefined ? '' : String(value);
    }
  }
  return values;
}

export default function MeasurementForm({
  customerId,
  onSuccess,
  initialData,
}: MeasurementFormProps) {
  const [values, setValues] = useState<Record<MeasurementField, string>>(
    buildInitialValues(initialData)
  );
  const [unit, setUnit] = useState<'cm' | 'inches'>(initialData?.unit || 'cm');
  const [takenAt, setTakenAt] = useState(formatDateInput(initialData?.takenAt));
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    try {
      const url = initialData?.id
        ? `/api/customers/${customerId}/measurements/${initialData.id}`
        : `/api/customers/${customerId}/measurements`;
      const response = await fetch(url, {
        method: initialData?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {sections.map((section) => (
        <fieldset key={section.title} className="space-y-3">
          <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {section.title}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values[field.name]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
                  placeholder={unit}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Notes
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Taken at</label>
            <input
              type="date"
              value={takenAt}
              onChange={(event) => setTakenAt(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
              {(['cm', 'inches'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setUnit(option)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                    unit === option
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save measurements'}
        </button>
      </div>
    </form>
  );
}
