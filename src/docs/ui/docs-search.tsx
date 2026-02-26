'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { DocEntry } from '@/docs/registry';
import { slugToPath } from '@/docs/registry';
import { Link } from '@/i18n/routing';

export default function DocsSearch({ docs }: { docs: readonly DocEntry[] }) {
  const [q, setQ] = useState('');
  const t = useTranslations('docs');

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];

    return docs
      .map(d => ({
        d,
        score: [d.title, d.description].join(' ').toLowerCase().includes(query)
          ? 1
          : 0,
      }))
      .filter(x => x.score > 0)
      .slice(0, 8)
      .map(x => x.d);
  }, [docs, q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>

      {q.trim() ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">
              {t('searchNoResults')}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map(entry => (
                <li key={entry.slug.join('/')}>
                  <Link
                    href={slugToPath(entry.slug)}
                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {entry.title}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {entry.description}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
