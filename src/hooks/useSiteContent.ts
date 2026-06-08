/**
 * useSiteContent — Supabase-backed editable story & site text
 *
 * - Fetches all key/value pairs from site_content table (or falls back to beautiful defaults).
 * - Provides simple save(key, value) that upserts instantly.
 * - Realtime optional (we poll lightly or rely on manual refresh after Studio saves).
 * - Keeps public pages 100% reactive to Angel's Studio edits.
 */
import { useEffect, useState, useCallback } from 'react';
import { getSupabase, fetchSiteContent, saveSiteContent, SITE_CONTENT_TABLE } from '../lib/supabase';

interface UseSiteContentResult {
  content: Record<string, string>;
  loading: boolean;
  error: string | null;
  save: (key: string, value: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSiteContent(): UseSiteContentResult {
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSiteContent();
      setContent(data);
    } catch (err: any) {
      console.error('[useSiteContent] load failed', err);
      setError('Could not load story content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Lightweight realtime for content changes (Studio updates)
    let channel: any = null;
    try {
      const supabase = getSupabase();
      channel = supabase
        .channel('site-content-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: SITE_CONTENT_TABLE }, () => {
          load().catch(() => {});
        })
        .subscribe();
    } catch (_) {
      // realtime optional — fine if it fails
    }

    return () => {
      if (channel) {
        try { getSupabase().removeChannel(channel); } catch (_) {}
      }
    };
  }, [load]);

  const save = useCallback(async (key: string, value: string) => {
    await saveSiteContent(key, value);
    setContent((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refetch = load;

  return { content, loading, error, save, refetch };
}
