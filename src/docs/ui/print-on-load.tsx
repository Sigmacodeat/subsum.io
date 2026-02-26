'use client';

import { useEffect } from 'react';

export default function PrintOnLoad({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const id = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // noop
      }
    }, 50);

    return () => window.clearTimeout(id);
  }, [enabled]);

  return null;
}
