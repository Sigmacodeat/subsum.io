'use client';

import { Download } from 'lucide-react';
import { useCallback, useMemo } from 'react';

export default function PdfDownloadButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const href = useMemo(() => {
    if (typeof window === 'undefined') return '';

    const url = new URL(window.location.href);
    url.searchParams.set('print', '1');
    return url.toString();
  }, []);

  const onClick = useCallback(() => {
    if (!href) return;

    window.open(href, '_blank', 'noopener,noreferrer');
  }, [href]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? 'btn-secondary !px-4 !py-2.5 !text-sm'}
      aria-label={`${title} als PDF speichern`}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span>{title} als PDF</span>
    </button>
  );
}
