/**
 * useInquiries — Receives custom order requests from the beautiful public contact form
 * and "Request this bake" flows. Angel reviews & follows up from inside the Studio.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase, type Inquiry, INQUIRIES_TABLE } from '../lib/supabase';

interface UseInquiriesResult {
  inquiries: Inquiry[];
  loading: boolean;
  error: string | null;
  submit: (inq: Omit<Inquiry, 'id' | 'created_at' | 'handled'>) => Promise<void>;
  markHandled: (id: string, handled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useInquiries(): UseInquiriesResult {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const fetchAll = useCallback(async () => {
    const supabase = getSupabase();
    const { data, error: err } = await supabase
      .from(INQUIRIES_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (err) throw err;
    return (data as Inquiry[]) || [];
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAll();
      setInquiries(data);
    } catch (err: any) {
      console.error('[useInquiries]', err);
      setError(err.message || 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    load();

    try {
      const supabase = getSupabase();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const ch = supabase
        .channel('inquiries-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: INQUIRIES_TABLE }, () => {
          load().catch(() => {});
        })
        .subscribe();
      channelRef.current = ch;
    } catch (_) {}

    return () => {
      if (channelRef.current) {
        try { getSupabase().removeChannel(channelRef.current); } catch (_) {}
      }
    };
  }, [load]);

  const submit = useCallback(async (inq: Omit<Inquiry, 'id' | 'created_at' | 'handled'>) => {
    const supabase = getSupabase();
    const { error } = await supabase.from(INQUIRIES_TABLE).insert({
      ...inq,
      handled: false,
    });
    if (error) throw error;
  }, []);

  const markHandled = useCallback(async (id: string, handled: boolean) => {
    const supabase = getSupabase();
    const { error } = await supabase.from(INQUIRIES_TABLE).update({ handled }).eq('id', id);
    if (error) throw error;
  }, []);

  return { inquiries, loading, error, submit, markHandled, refetch: load };
}
