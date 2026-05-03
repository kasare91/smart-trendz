'use client';

import { useRouter } from 'next/navigation';
import type { BusinessProfile } from '@prisma/client';
import BusinessProfileForm from '@/components/BusinessProfileForm';

export default function BusinessProfileFormClient({ profile }: { profile: BusinessProfile }) {
  const router = useRouter();

  const handleSubmit = async (data: Record<string, string | null>) => {
    const response = await fetch('/api/business-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update business profile');
    }

    router.refresh();
  };

  return <BusinessProfileForm initialProfile={profile} submitLabel="Save Settings" onSubmit={handleSubmit} />;
}
