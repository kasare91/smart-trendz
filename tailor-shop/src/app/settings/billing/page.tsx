'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface BillingStatus {
  plan: 'FREE' | 'PRO';
  planStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'FREE';
  trialEndsAt: string | null;
  ordersThisMonth: number;
  orderLimit: number | null;
  hasStripeCustomer: boolean;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 bg-gray-200 rounded w-32" />
          <div className="h-6 bg-gray-200 rounded-full w-16" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-48" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-24" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-full" />
        ))}
      </div>
      <div className="h-12 bg-gray-200 rounded-lg w-full" />
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === 'PRO') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
        PRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-700">
      FREE
    </span>
  );
}

function TrialCountdown({ trialEndsAt }: { trialEndsAt: string }) {
  const end = new Date(trialEndsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (daysLeft === 0) {
    return (
      <p className="mt-2 text-sm text-red-600 font-medium">
        Trial expired. Upgrade to keep PRO features.
      </p>
    );
  }

  return (
    <p className="mt-2 text-sm text-amber-600 font-medium">
      Trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.
    </p>
  );
}

function OrderUsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Orders this month</span>
        <span className={`font-semibold ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-900'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isAtLimit && (
        <p className="text-xs text-red-600">
          You have reached your monthly order limit. Upgrade to PRO for unlimited orders.
        </p>
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-amber-600">
          You are approaching your monthly limit. Consider upgrading to PRO.
        </p>
      )}
    </div>
  );
}

const FREE_FEATURES = [
  { label: 'Up to 50 orders per month', included: true },
  { label: '1 branch', included: true },
  { label: 'Customer management', included: true },
  { label: 'Payment tracking', included: true },
  { label: 'Unlimited orders', included: false },
  { label: 'Multiple branches', included: false },
  { label: 'Advanced analytics', included: false },
  { label: 'Priority support', included: false },
];

const PRO_FEATURES = [
  { label: 'Unlimited orders per month', included: true },
  { label: 'Multiple branches', included: true },
  { label: 'Customer management', included: true },
  { label: 'Payment tracking', included: true },
  { label: 'Advanced analytics', included: true },
  { label: 'Priority support', included: true },
  { label: 'Early access to new features', included: true },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/status');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to load billing status');
        }
        const data: BillingStatus = await res.json();
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleUpgrade = async () => {
    setIsActing(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsActing(false);
    }
  };

  const handleManage = async () => {
    setIsActing(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to open billing portal');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsActing(false);
    }
  };

  const isPro = status?.plan === 'PRO';
  const isCancelled = status?.planStatus === 'CANCELLED';
  const isPastDue = status?.planStatus === 'PAST_DUE';
  const showUpgrade = !isPro || isCancelled;
  const showPortal = !showUpgrade || isPastDue;
  const features = isPro ? PRO_FEATURES : FREE_FEATURES;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing &amp; Plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and view plan limits.
        </p>
      </div>

      {isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-3">
          <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-emerald-800">
            You&apos;re now on PRO! Enjoy unlimited orders and branches.
          </p>
        </div>
      )}

      {isLoading ? (
        <SkeletonCard />
      ) : status ? (
        <>
          {/* Plan Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Current Plan</h2>
              <PlanBadge plan={status.plan} />
            </div>

            <p className="text-sm text-gray-600">
              Status:{' '}
              <span className={`font-medium ${
                status.planStatus === 'ACTIVE' ? 'text-emerald-600' :
                status.planStatus === 'TRIAL' ? 'text-amber-600' :
                status.planStatus === 'CANCELLED' ? 'text-red-600' :
                status.planStatus === 'PAST_DUE' ? 'text-yellow-600' :
                'text-gray-700'
              }`}>
                {status.planStatus.charAt(0) + status.planStatus.slice(1).toLowerCase()}
              </span>
            </p>

            {status.trialEndsAt && status.planStatus === 'TRIAL' && (
              <TrialCountdown trialEndsAt={status.trialEndsAt} />
            )}

            {!isPro && status.orderLimit !== null && (
              <OrderUsageBar used={status.ordersThisMonth} limit={status.orderLimit} />
            )}
          </div>

          {status.planStatus === 'PAST_DUE' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              Your payment is past due. Please update your payment method to maintain access.
            </div>
          )}

          {/* Features List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {isPro ? 'PRO Plan includes' : 'FREE Plan includes'}
            </h3>
            <ul className="space-y-2.5">
              {features.map((feature) => (
                <li key={feature.label} className="flex items-center space-x-3">
                  {feature.included ? (
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={`text-sm ${feature.included ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Button */}
          <div className="space-y-3">
            {showUpgrade && !isPastDue && (
              <button
                onClick={handleUpgrade}
                disabled={isActing}
                className="w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
              >
                {isActing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Redirecting...
                  </>
                ) : isCancelled ? (
                  'Reactivate subscription'
                ) : (
                  'Upgrade to PRO — $29/month'
                )}
              </button>
            )}

            {(showPortal && status.hasStripeCustomer) && (
              <button
                onClick={handleManage}
                disabled={isActing}
                className="w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors border border-purple-200"
              >
                {isActing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-purple-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Opening portal...
                  </>
                ) : isPastDue ? (
                  'Update payment method'
                ) : (
                  'Manage subscription'
                )}
              </button>
            )}

            {error && (
              <p className="text-sm text-red-600 text-center px-2">{error}</p>
            )}
          </div>
        </>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{error ?? 'Failed to load billing information.'}</p>
        </div>
      )}

      <div className="pt-2">
        <Link href="/settings" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to settings
        </Link>
      </div>
    </div>
  );
}
