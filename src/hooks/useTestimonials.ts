/**
 * useTestimonials — Fully editable warm testimonials powered by Supabase
 * Angel manages quotes, names, roles, and order directly from the Studio.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase, type Testimonial, TESTIMONIALS_TABLE } from '../lib/supabase';

interface UseTestimonialsResult {
  testimonials: Testimonial[];
  loading: boolean;
  error: string | null;
  add: (t: Omit<Testimonial, 'id' | 'created_at' | 'display_order'>) => Promise<void>;
  update: (id: string, patch: Partial<Testimonial>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useTestimonials(): UseTestimonialsResult {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const sort = (list: Testimonial[]) =>
    [...list].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));

  const fetchAll = useCallback(async () => {
    const supabase = getSupabase();
    const { data, error: err } = await supabase
      .from(TESTIMONIALS_TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (err) throw err;
    return sort((data as Testimonial[]) || []);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAll();
      setTestimonials(data);
    } catch (err: any) {
      console.error('[useTestimonials]', err);
      setError(err.message || 'Failed to load testimonials');
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
        .channel('testimonials-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: TESTIMONIALS_TABLE }, () => {
          load().catch(() => {});
        })
        .subscribe();

      channelRef.current = ch;
    } catch (e) {
      // non-fatal
    }

    return () => {
      if (channelRef.current) {
        try { getSupabase().removeChannel(channelRef.current); } catch (_) {}
      }
    };
  }, [load]);

  const add = useCallback(async (t: Omit<Testimonial, 'id' | 'created_at' | 'display_order'>) => {
    const supabase = getSupabase();
    const maxOrder = testimonials.length ? Math.max(...testimonials.map(x => x.display_order)) : -1;
    const { error } = await supabase.from(TESTIMONIALS_TABLE).insert({
      quote: t.quote.trim(),
      name: t.name.trim(),
      role: t.role.trim(),
      display_order: maxOrder + 1,
    });
    if (error) throw error;
  }, [testimonials]);

  const update = useCallback(async (id: string, patch: Partial<Testimonial>) => {
    const supabase = getSupabase();
    const { error } = await supabase.from(TESTIMONIALS_TABLE).update(patch).eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from(TESTIMONIALS_TABLE).delete().eq('id', id);
    if (error) throw error;
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    const supabase = getSupabase();
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from(TESTIMONIALS_TABLE).update({ display_order: idx }).eq('id', id)
      )
    );
  }, []);

  const refetch = load;

  return { testimonials, loading, error, add, update, remove, reorder, refetch };
}
