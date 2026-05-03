'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SetupGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname.startsWith('/setup') || pathname.startsWith('/api')) return;

    let cancelled = false;

    fetch('/api/business-profile')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.needsSetup) {
          router.replace('/setup');
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
