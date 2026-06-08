/**
 * useBakes hook — Supabase Data Layer (Hardened with Realtime + Polling Fallback)
 *
 * The single source of truth for all bake data. Pure Supabase, zero localStorage.
 *
 * HARDENED IMPROVEMENTS:
 * - Full postgres_changes realtime subscription for instant gallery + Studio updates.
 * - GRACEFUL FALLBACK: If realtime fails to subscribe (common on some networks/VPNs/firewalls),
 *   automatically starts polling every 30 seconds so the UI still eventually reflects changes.
 * - Very verbose console logging for connection status, errors, and fallback activation (great for debugging on phone via remote console).
 * - Optimistic local sorting after patches so UI feels instant even before server roundtrips.
 * - Manual refetch() exposed for Studio "Refresh" button and after critical mutations as safety net.
 *
 * Realtime is preferred. Polling is only a reliable last resort.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase, type Bake, BAKES_TABLE } from '../lib/supabase';

interface UseBakesResult {
  bakes: Bake[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30000; // 30s — good balance for a personal portfolio

export function useBakes(): UseBakesResult {
  const [bakes, setBakes] = useState<Bake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup of realtime + polling
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const usingPollingRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      if (usingPollingRef.current) {
        console.log('[useBakes] Polling stopped (realtime recovered or unmount).');
        usingPollingRef.current = false;
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    clearPolling();
    usingPollingRef.current = true;
    console.warn(
      `[useBakes] Realtime unavailable — falling back to polling every ${POLL_INTERVAL_MS / 1000}s. ` +
      'Gallery will still update, just not instantly. Check Supabase realtime settings / network.'
    );

    pollIntervalRef.current = window.setInterval(() => {
      console.log('[useBakes] Polling fetch...');
      fetchBakesInternal().catch((e) => console.error('[useBakes] Poll fetch failed:', e));
    }, POLL_INTERVAL_MS);
  }, []);

  const fetchBakesInternal = useCallback(async () => {
    const supabase = getSupabase();

    const { data, error: fetchError } = await supabase
      .from(BAKES_TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    const sorted = sortBakes((data as Bake[]) || []);
    setBakes(sorted);
    return sorted;
  }, []);

  const fetchBakes = useCallback(async () => {
    try {
      setError(null);
      await fetchBakesInternal();
    } catch (err: any) {
      console.error('[useBakes] Fetch failed:', err);
      setError(err.message || 'Failed to load bakes from Supabase');
    } finally {
      setLoading(false);
    }
  }, [fetchBakesInternal]);

  // Initial fetch + attempt realtime. Graceful polling fallback on failure.
  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      await fetchBakes();

      if (!isMounted) return;

      try {
        const supabase = getSupabase();

        // Clean any previous
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }

        // FIXED: Use a unique channel name on every setup attempt.
        // Re-using the exact same channel name ('bakes-realtime-v2') across effect re-runs,
        // StrictMode double-invocations, or hot reloads can cause Supabase to throw:
        // "cannot add `postgres_changes` callbacks ... after `subscribe()`"
        // A unique name per attempt + proper removeChannel in cleanup avoids the race.
        const channelName = `bakes-realtime-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: BAKES_TABLE },
            (payload) => {
              // Realtime patch — keep sorted
              if (payload.eventType === 'INSERT') {
                const newBake = payload.new as Bake;
                setBakes((prev) => {
                  if (prev.some((b) => b.id === newBake.id)) return prev;
                  return sortBakes([...prev, newBake]);
                });
              } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as Bake;
                setBakes((prev) =>
                  sortBakes(prev.map((b) => (b.id === updated.id ? updated : b)))
                );
              } else if (payload.eventType === 'DELETE') {
                const deletedId = (payload.old as any).id as string;
                setBakes((prev) => prev.filter((b) => b.id !== deletedId));
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('[useBakes] ✅ Realtime connected (postgres_changes live).');
              clearPolling(); // stop any fallback
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
              console.warn('[useBakes] Realtime subscribe issue:', status, err);
              if (!usingPollingRef.current) {
                startPolling();
              }
            }
          });

        channelRef.current = channel;
      } catch (e: any) {
        console.error('[useBakes] Failed to create realtime channel:', e);
        if (!usingPollingRef.current) {
          startPolling();
        }
      }
    };

    setup();

    return () => {
      isMounted = false;
      clearPolling();

      if (channelRef.current) {
        try {
          const supabase = getSupabase();
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          // ignore cleanup errors
        }
        channelRef.current = null;
      }
    };
  }, [fetchBakes, startPolling, clearPolling]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchBakes();
  }, [fetchBakes]);

  return { bakes, loading, error, refetch };
}

/** Consistent sort helper (used after both server fetches and realtime patches) */
function sortBakes(list: Bake[]): Bake[] {
  return [...list].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.created_at.localeCompare(b.created_at);
  });
}
