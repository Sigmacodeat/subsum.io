import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface QuickCheckHandoffPayload {
  usage: 'single' | 'recurring' | 'team';
  urgency: 'today' | 'week' | 'flexible';
  depth: 'quick' | 'strategy' | 'full';
  locale: string;
  score: number;
  supported: number;
  unsupported: number;
  likelyScans: number;
  totalMb: number;
  recommendationTier: 'credit' | 'trial' | 'kanzlei';
}

export type QuickCheckHandoffStatus =
  | 'idle'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'expired';

const STORAGE_KEY = 'quick_check_handoff';

function decodeHandoffToken(token: string): QuickCheckHandoffPayload | null {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded);
    if (
      parsed.source !== 'marketing-quick-check' ||
      typeof parsed.score !== 'number' ||
      typeof parsed.recommendationTier !== 'string'
    ) {
      return null;
    }
    return {
      usage: parsed.usage ?? 'single',
      urgency: parsed.urgency ?? 'today',
      depth: parsed.depth ?? 'quick',
      locale: parsed.locale ?? 'en',
      score: parsed.score,
      supported: parsed.supported ?? 0,
      unsupported: parsed.unsupported ?? 0,
      likelyScans: parsed.likelyScans ?? 0,
      totalMb: parsed.totalMb ?? 0,
      recommendationTier: parsed.recommendationTier,
    };
  } catch {
    return null;
  }
}

export function useQuickCheckHandoff(): {
  status: QuickCheckHandoffStatus;
  payload: QuickCheckHandoffPayload | null;
  dismiss: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<QuickCheckHandoffStatus>('idle');
  const [payload, setPayload] = useState<QuickCheckHandoffPayload | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const token = searchParams.get('quickCheck');
    if (!token) {
      // Check if there's a stored handoff from a previous page load
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as QuickCheckHandoffPayload;
          setPayload(parsed);
          setStatus('valid');
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
      return;
    }

    processedRef.current = true;
    setStatus('validating');

    // Decode the token client-side (fast path)
    const decoded = decodeHandoffToken(token);
    if (!decoded) {
      setStatus('invalid');
      // Clean up query params
      const next = new URLSearchParams(searchParams);
      next.delete('quickCheck');
      next.delete('sig');
      next.delete('source');
      setSearchParams(next, { replace: true });
      return;
    }

    // Store in sessionStorage so it survives navigation within the app
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(decoded));
    setPayload(decoded);
    setStatus('valid');

    // Clean up query params from URL
    const next = new URLSearchParams(searchParams);
    next.delete('quickCheck');
    next.delete('sig');
    next.delete('source');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const dismiss = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPayload(null);
    setStatus('idle');
  }, []);

  return { status, payload, dismiss };
}
