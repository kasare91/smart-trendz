import { redirect } from 'next/navigation';
import Link from 'next/link';
import BusinessProfileFormClient from './profile-form-client';
import { getBusinessProfile } from '@/lib/business-profile';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([
    getBusinessProfile(),
    getCurrentUser(),
  ]);

  if (!profile) {
    redirect('/setup');
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update your boutique profile, branding, and receipt settings.
        </p>
      </div>
      <BusinessProfileFormClient profile={profile} />
      {isAdmin && (
        <Link
          href="/settings/billing"
          className="block w-full bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-purple-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                Billing &amp; Plan
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Manage your subscription and view plan limits.
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}
    </div>
  );
}
