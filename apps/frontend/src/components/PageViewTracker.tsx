'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getPostHogClient } from '@/lib/analytics/client';

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ph = getPostHogClient();
    if (ph) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      ph.capture('$pageview', { path: url });
    }
  }, [pathname, searchParams]);

  return null;
}