/**
 * useBakes hook — Vercel Blob edition
 *
 * Central (and only) data layer.
 * - Fetches the current list of bakes from /api/bakes
 * - The server reads a JSON manifest stored in Vercel Blob (manifest/bakes.json)
 * - No localStorage ever.
 * - No realtime (we refetch after mutations in the Studio for simplicity and reliability).
 * - Returns sorted bakes (by display_order then created_at).
 */

import { useEffect, useState, useCallback } from 'react';
import type { Bake } from '../lib/bakes';

interface UseBakesResult {
  bakes: Bake[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBakes(): UseBakesResult {
  const [bakes, setBakes] = useState<Bake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBakes = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/bakes', {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Failed to load bakes: ${res.status}`);
      }

      const data: Bake[] = await res.json();

      // Ensure stable sort (same logic the server and Studio use)
      const sorted = [...(data || [])].sort((a, b) => {
        if (a.display_order !== b.display_order) {
          return a.display_order - b.display_order;
        }
        return a.created_at.localeCompare(b.created_at);
      });

      setBakes(sorted);
    } catch (err: any) {
      console.error('Failed to fetch bakes from /api/bakes:', err);
      setError(err.message || 'Failed to load gallery');
      // Keep previous data on error so UI doesn't flash empty
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load only (no realtime subscription)
  useEffect(() => {
    fetchBakes();
  }, [fetchBakes]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchBakes();
  }, [fetchBakes]);

  return { bakes, loading, error, refetch };
}
