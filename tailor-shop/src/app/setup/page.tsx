'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BusinessProfileForm from '@/components/BusinessProfileForm';

export default function SetupPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/business-profile')
      .then((r) => r.json())
      .then(({ needsSetup }) => {
        if (!needsSetup) router.replace('/settings');
      })
      .catch(() => {
        // If the check fails, let the user proceed with setup
      });
  }, [router]);

  const handleSubmit = async (data: Record<string, string | null>) => {
    const response = await fetch('/api/business-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create business profile');
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Set up your boutique</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add your business details so orders, reminders, and receipts use your own brand.
        </p>
      </div>
      <BusinessProfileForm submitLabel="Finish Setup" onSubmit={handleSubmit} />
    </div>
  );
}
