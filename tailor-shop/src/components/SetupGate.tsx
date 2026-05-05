'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { fetchCached } from '@/lib/client-cache';

export default function SetupGate() {
  const pathname = usePathname();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (pathname.startsWith('/setup') || pathname.startsWith('/api')) return;
    // Only check once per session — setup status never changes mid-session
    if (checked.current) return;
    checked.current = true;

    fetchCached(
      'business-profile',
      () => fetch('/api/business-profile').then(r => r.json()),
    ).then((data) => {
      if ((data as { needsSetup?: boolean }).needsSetup) {
        router.replace('/setup');
      }
    }).catch(() => undefined);
  }, [pathname, router]);

  return null;
}
