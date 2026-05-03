'use client';

import { useEffect } from 'react';
import { DEFAULT_BUSINESS_NAME } from '@/lib/business-profile';

export default function BusinessTitle({ businessName }: { businessName?: string | null }) {
  useEffect(() => {
    document.title = `${businessName || DEFAULT_BUSINESS_NAME} Manager`;
  }, [businessName]);

  return null;
}
