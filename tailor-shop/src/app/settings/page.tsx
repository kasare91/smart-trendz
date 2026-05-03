import { redirect } from 'next/navigation';
import BusinessProfileFormClient from './profile-form-client';
import { getBusinessProfile } from '@/lib/business-profile';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
  const profile = await getBusinessProfile();

  if (!profile) {
    redirect('/setup');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update your boutique profile, branding, and receipt settings.
        </p>
      </div>
      <BusinessProfileFormClient profile={profile} />
    </div>
  );
}
