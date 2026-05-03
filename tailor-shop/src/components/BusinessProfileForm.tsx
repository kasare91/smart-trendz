'use client';

import { useRef, useState } from 'react';
import type { BusinessProfile } from '@prisma/client';
import BusinessLogo from './BusinessLogo';

type BusinessProfileFormProps = {
  initialProfile?: Partial<BusinessProfile> | null;
  submitLabel: string;
  onSubmit: (data: Record<string, string | null>) => Promise<void>;
};

export default function BusinessProfileForm({
  initialProfile,
  submitLabel,
  onSubmit,
}: BusinessProfileFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    businessName: initialProfile?.businessName || '',
    businessType: initialProfile?.businessType || 'Tailor Shop',
    ownerName: initialProfile?.ownerName || '',
    phoneNumber: initialProfile?.phoneNumber || '',
    email: initialProfile?.email || '',
    address: initialProfile?.address || '',
    city: initialProfile?.city || '',
    country: initialProfile?.country || 'Ghana',
    currency: initialProfile?.currency || 'GHS',
    logoUrl: initialProfile?.logoUrl || '',
    logoPath: initialProfile?.logoPath || '',
    brandColor: initialProfile?.brandColor || '',
    receiptFooterNote: initialProfile?.receiptFooterNote || '',
    invoicePrefix: initialProfile?.invoicePrefix || 'ORD',
  });

  const updateField = (field: string, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleLogoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError('');

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('prefix', 'logos');

      const response = await fetch('/api/uploads/images', {
        method: 'POST',
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      setFormData((current) => ({
        ...current,
        logoUrl: data.url,
        logoPath: data.path,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onSubmit({
        ...formData,
        brandColor: formData.brandColor || null,
        logoUrl: formData.logoUrl || null,
        logoPath: formData.logoPath || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save business profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        <div className="flex items-center gap-4">
          <BusinessLogo
            businessName={formData.businessName}
            logoUrl={formData.logoUrl}
            brandColor={formData.brandColor}
            size="lg"
          />
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
            {formData.logoUrl && (
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, logoUrl: '', logoPath: '' }))}
                className="ml-3 text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Business Name *" value={formData.businessName} onChange={(value) => updateField('businessName', value)} required />
          <TextField label="Business Type" value={formData.businessType} onChange={(value) => updateField('businessType', value)} />
          <TextField label="Owner Name" value={formData.ownerName} onChange={(value) => updateField('ownerName', value)} />
          <TextField label="Phone Number" value={formData.phoneNumber} onChange={(value) => updateField('phoneNumber', value)} />
          <TextField label="Email" type="email" value={formData.email} onChange={(value) => updateField('email', value)} />
          <TextField label="Currency" value={formData.currency} onChange={(value) => updateField('currency', value.toUpperCase())} maxLength={3} />
          <TextField label="City" value={formData.city} onChange={(value) => updateField('city', value)} />
          <TextField label="Country" value={formData.country} onChange={(value) => updateField('country', value)} />
          <TextField label="Invoice Prefix" value={formData.invoicePrefix} onChange={(value) => updateField('invoicePrefix', value.toUpperCase())} maxLength={12} />
          <TextField label="Brand Color" type="color" value={formData.brandColor || '#0ea5e9'} onChange={(value) => updateField('brandColor', value)} />
        </div>

        <TextArea label="Address" value={formData.address} onChange={(value) => updateField('address', value)} />
        <TextArea label="Receipt Footer Note" value={formData.receiptFooterNote} onChange={(value) => updateField('receiptFooterNote', value)} />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <input
        type={type}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    </label>
  );
}
