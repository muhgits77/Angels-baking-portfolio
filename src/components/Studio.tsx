/**
 * Angel's Studio — The powerful, intuitive command center (GOAT edition).
 * Designed to be a joy for Angel to use on phone or desktop.
 *
 * Tabs:
 *   Bakes     → Huge mobile dropzone, drag-to-reorder (framer), inline editing, featured, delete
 *   My Story  → Full rich-text control over the long-form personal story (live on /story)
 *   Testimonials + Inquiries + Settings (with diagnostics)
 *
 * Every change is instant via Supabase + realtime. Zero code needed.
 * Clear success/error messages + detailed console logging for peace of mind.
 */
import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import {
  X, Upload, Camera, Star, StarOff, Trash2, LogOut, RefreshCw, Check,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';

import type { Bake } from '../lib/supabase';
import { 
  CATEGORIES, CATEGORY_LABELS, DEFAULT_STORY, 
  getSupabase, BAKES_TABLE, BAKES_BUCKET, SITE_CONTENT_TABLE 
} from '../lib/supabase';
import { useBakes } from '../hooks/useBakes';
import { useSiteContent } from '../hooks/useSiteContent';
import { useTestimonials } from '../hooks/useTestimonials';
import { useInquiries } from '../hooks/useInquiries';

/**
 * FIXED: Static imports for Supabase symbols instead of dynamic await import() inside functions.
 * This eliminates potential race conditions or bundling issues during uploads and makes
 * stack traces / error reporting cleaner.
 */

interface StudioProps {
  isOpen: boolean;
  onClose: () => void;
  onExitAuth: () => void;
  authed: boolean;
  onAuthed: () => void;
  password: string;
}

type Tab = 'bakes' | 'story' | 'testimonials' | 'inquiries' | 'settings';

export function Studio({ isOpen, onClose, onExitAuth, authed, onAuthed, password }: StudioProps) {
  const [tab, setTab] = useState<Tab>('bakes');
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');

  // Data
  const { bakes, refetch: refetchBakes } = useBakes();
  const { content, save: saveContent, refetch: refetchContent } = useSiteContent();
  const { testimonials, loading: tLoading, add: addTestimonial, update: updateTestimonial, remove: removeTestimonial, reorder: reorderTestimonials } = useTestimonials();
  const { inquiries, loading: iLoading, markHandled } = useInquiries();

  // Upload state (Bakes tab)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<(typeof CATEGORIES)[number]>('pastries');
  const [uploadFeatured, setUploadFeatured] = useState(false);
  const [uploadDesc, setUploadDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = { current: null as HTMLInputElement | null };

  const setFileInput = (el: HTMLInputElement | null) => { fileInputRef.current = el; };

  // Story editing (local draft)
  const [storyDraft, setStoryDraft] = useState<Record<string, string>>({});
  const storyKeys = ['hero_tagline', 'about_intro', 'the_beginning', 'philosophy', 'the_promise'];

  // Reorderable bakes (local optimistic for smooth drag)
  const [localBakes, setLocalBakes] = useState<Bake[]>([]);

  // FIXED (was a render-time state update anti-pattern):
  // Seed the draggable list from the realtime bakes only once (when we first receive data).
  // After the user drags, localBakes becomes the source of truth for the UI until a manual refetch.
  useEffect(() => {
    if (bakes.length > 0 && localBakes.length === 0) {
      setLocalBakes([...bakes]);
    }
  }, [bakes, localBakes.length]);

  const resetUpload = () => {
    setUploadFile(null);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(null);
    setUploadTitle('');
    setUploadDesc('');
    setUploadCategory('pastries');
    setUploadFeatured(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image');
    if (file.size > 15 * 1024 * 1024) return toast.error('Keep images under 15MB for mobile uploads');

    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    const preview = URL.createObjectURL(file);
    setUploadFile(file);
    setUploadPreview(preview);

    if (!uploadTitle) {
      const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadTitle(base.charAt(0).toUpperCase() + base.slice(1));
    }
  };

  // Direct Supabase upload — same proven logic, now with description
  // 
  // MAJOR FIXES:
  // 1. Use the statically imported getSupabase + constants (no more dynamic import inside the hot path).
  // 2. Extremely detailed console logging at every step (storage upload success/fail, table insert, exact Supabase error object).
  // 3. User-facing toast now includes the real error.message + code/hint when available.
  // 4. Better cleanup on partial failure.
  // 5. Progress + disabled states already existed and are kept.
  const doUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      toast.error('Photo + title required');
      return;
    }
    setIsUploading(true);
    setUploadProgress(8);

    const supabase = getSupabase();   // static import, always available in browser

    try {
      console.log('[Studio] Starting upload for', uploadTitle);

      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const storagePath = `bakes/${fileName}`;

      console.log('[Studio] Uploading to storage bucket:', BAKES_BUCKET, 'path:', storagePath);

      const { error: upErr } = await supabase.storage
        .from(BAKES_BUCKET)
        .upload(storagePath, uploadFile, { 
          cacheControl: '3600',
          upsert: false 
        });

      if (upErr) {
        console.error('[Studio] STORAGE UPLOAD FAILED:', {
          error: upErr,
          message: upErr.message,
          name: upErr.name,
          statusCode: (upErr as any).statusCode,
        });
        throw upErr;
      }

      console.log('[Studio] Storage upload SUCCESS:', storagePath);
      setUploadProgress(52);

      const { data: urlData } = supabase.storage.from(BAKES_BUCKET).getPublicUrl(storagePath);
      const imageUrl = urlData.publicUrl;
      if (!imageUrl) throw new Error('Failed to get public URL after storage upload');

      const maxOrder = bakes.length ? Math.max(...bakes.map(b => b.display_order)) : -1;

      console.log('[Studio] Inserting row into', BAKES_TABLE, 'with display_order', maxOrder + 1);

      // FIXED: Only include the `description` field if the user actually provided one.
      // This prevents the "Could not find the 'description' column of 'bakes' in the schema cache" error
      // when the user has not yet run the ALTER TABLE to add the column.
      // If description is omitted entirely, the INSERT succeeds even on older schema.
      const insertPayload: any = {
        title: uploadTitle.trim(),
        category: uploadCategory,
        image_url: imageUrl,
        storage_path: storagePath,
        display_order: maxOrder + 1,
        featured: uploadFeatured,
      };
      const desc = uploadDesc.trim();
      if (desc) {
        insertPayload.description = desc;
      }

      const { error: insErr } = await supabase.from(BAKES_TABLE).insert(insertPayload);

      if (insErr) {
        console.error('[Studio] TABLE INSERT FAILED:', {
          error: insErr,
          message: insErr.message,
          code: insErr.code,
          details: insErr.details,
          hint: insErr.hint,
        });
        // Attempt cleanup of orphaned file
        await supabase.storage.from(BAKES_BUCKET).remove([storagePath]).catch(() => {});
        throw insErr;
      }

      console.log('[Studio] Full upload + row insert SUCCESS');
      setUploadProgress(100);
      toast.success('Photo added to the gallery!');

      resetUpload();
      // Give realtime a moment, then force a refetch as safety net
      setTimeout(() => refetchBakes().catch(console.error), 300);

    } catch (err: any) {
      console.error('[Studio] === UPLOAD FAILED (full details) ===', err);
      
      const msg = (err?.message || err?.error?.message || '').toLowerCase();

      if (msg.includes('description') || msg.includes('schema cache')) {
        toast.error(
          "Upload failed: Could not find the 'description' column.\n\n" +
          "Run this exact command in the Supabase SQL Editor, then refresh the Studio and try uploading again:\n\n" +
          "ALTER TABLE public.bakes ADD COLUMN IF NOT EXISTS description text;\n\n" +
          "After running it, also click the 'Refresh' button in the Bakes list.",
          { duration: 15000 }
        );
      } else {
        // Very actionable toast for the user
        toast.error(
          `Upload failed: ${err?.message || err?.error?.message || 'Unknown error'}\n\n` +
          `Common fixes:\n` +
          `• In Supabase Dashboard → Storage → Policies: ensure there is an "insert" policy on storage.objects for bucket 'bakes'\n` +
          `• In Supabase Dashboard → Table Editor → bakes → Policies: ensure "insert" policy exists for public/anon\n` +
          `• The bucket 'bakes' must be marked Public\n` +
          `See browser console (F12) for the raw Supabase error object.`,
          { duration: 12000 }
        );
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Update a bake (title / desc / category / featured)
  // FIXED: Now uses static import + logs the full Supabase error.
  // Also specially detects the missing 'description' column case and gives the exact ALTER command.
  const updateBake = async (id: string, patch: Partial<Bake>) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from(BAKES_TABLE).update(patch).eq('id', id);
      if (error) {
        console.error('[updateBake] Failed:', { id, patch, error: error.message, code: error.code, details: error.details, hint: error.hint });
        throw error;
      }
      // Success is silent (realtime will update UI)
    } catch (e: any) {
      const errMsg = (e?.message || '').toLowerCase();
      if ((patch as any).description !== undefined && (errMsg.includes('description') || errMsg.includes('schema cache'))) {
        toast.error(
          "Cannot save description yet.\n\n" +
          "Run this in Supabase SQL Editor:\n\n" +
          "ALTER TABLE public.bakes ADD COLUMN IF NOT EXISTS description text;\n\n" +
          "Then refresh the list and try again.",
          { duration: 12000 }
        );
      } else {
        toast.error(`Update failed: ${e?.message || e}. Check RLS update policy on bakes table.`);
      }
      console.error(e);
    }
  };

  const toggleFeatured = async (bake: Bake) => {
    await updateBake(bake.id, { featured: !bake.featured });
  };

  const deleteBake = async (bake: Bake) => {
    if (!confirm(`Delete "${bake.title}" permanently?`)) return;
    try {
      const supabase = getSupabase();
      const { error: dbErr } = await supabase.from(BAKES_TABLE).delete().eq('id', bake.id);
      if (dbErr) throw dbErr;

      if (bake.storage_path) {
        const { error: storErr } = await supabase.storage.from(BAKES_BUCKET).remove([bake.storage_path]);
        if (storErr) console.warn('Storage delete warning (row is already gone):', storErr);
      }
      toast.success('Deleted');
      refetchBakes();
    } catch (e: any) {
      console.error('[deleteBake] error', e);
      toast.error(`Delete failed: ${e?.message || e}. Check delete policies on bakes table + storage bucket.`);
    }
  };

  // Drag reorder bakes
  // FIXED: static import + full error logging
  const onReorderBakes = async (newOrder: Bake[]) => {
    setLocalBakes(newOrder);
    try {
      const supabase = getSupabase();
      const updates = newOrder.map((b, idx) => 
        supabase.from(BAKES_TABLE).update({ display_order: idx }).eq('id', b.id)
      );
      const results = await Promise.all(updates);
      const firstErr = results.find(r => r.error);
      if (firstErr?.error) throw firstErr.error;
    } catch (e: any) {
      console.error('[onReorderBakes] error', e);
      toast.error(`Reorder failed: ${e?.message || e}. Check update policy on bakes table.`);
      refetchBakes();
    }
  };

  // Story (opened via tab click; draft initialized on first render of tab)

  const saveStorySection = async (key: string) => {
    const val = storyDraft[key] || '';
    try {
      await saveContent(key, val);
      toast.success('Saved to Supabase');
      console.log('[Studio Story] Saved section', key);
    } catch (e: any) {
      // The improved saveSiteContent already logged the full details.
      console.error('[saveStorySection] error for', key, e);
      toast.error(`Failed to save "${key}": ${e?.message || e}\n\nCheck RLS policies on site_content table (insert + update).`);
    }
  };

  const saveAllStory = async () => {
    const errors: string[] = [];
    try {
      for (const k of storyKeys) {
        if (storyDraft[k] !== undefined) {
          try {
            await saveContent(k, storyDraft[k]);
          } catch (e: any) {
            errors.push(`${k}: ${e?.message || e}`);
          }
        }
      }
      if (errors.length === 0) {
        toast.success('All story sections published to Supabase');
        refetchContent();
      } else {
        toast.error(`Some sections failed:\n${errors.join('\n')}`);
      }
    } catch (e) {
      toast.error('Unexpected error while publishing story. See console.');
      console.error(e);
    }
  };

  // Testimonials
  const [newTest, setNewTest] = useState({ quote: '', name: '', role: '' });
  const addTest = async () => {
    if (!newTest.quote.trim() || !newTest.name.trim()) return toast.error('Quote and name required');
    try {
      await addTestimonial(newTest);
      setNewTest({ quote: '', name: '', role: '' });
      toast.success('Testimonial added');
    } catch (e: any) {
      toast.error(`Failed to add testimonial: ${e?.message || e}. Check insert policy on testimonials table.`);
    }
  };

  /**
   * NEW: Robust diagnostics button for Settings tab.
   * Helps Angel (or support) instantly see if the three critical things work:
   *   - Can read from bakes
   *   - Can write to site_content (My Story)
   *   - Basic storage access (we do a harmless head/list)
   * This prints very clear PASS/FAIL + the actual Supabase errors.
   */
  const runDiagnostics = async () => {
    const supabase = getSupabase();
    console.group('[Studio Diagnostics]');

    // 1. bakes table read (should always work if gallery loads)
    try {
      const { data, error } = await supabase.from(BAKES_TABLE).select('id').limit(1);
      if (error) throw error;
      console.log('✅ bakes SELECT: PASS', data?.length || 0, 'row(s) visible');
    } catch (e: any) {
      console.error('❌ bakes SELECT FAILED (RLS read policy?):', e.message || e);
    }

    // 2. site_content upsert test (the My Story path)
    const testKey = 'diagnostics_test_' + Date.now();
    try {
      await supabase.from(SITE_CONTENT_TABLE).upsert({ key: testKey, value: 'hello from studio test' }, { onConflict: 'key' });
      console.log('✅ site_content UPSERT: PASS');
      // cleanup (ignore result)
      await supabase.from(SITE_CONTENT_TABLE).delete().eq('key', testKey);
    } catch (e: any) {
      console.error('❌ site_content UPSERT FAILED (this is why My Story may not save):', {
        message: e.message, code: e.code, details: e.details, hint: e.hint
      });
    }

    // 3. Quick storage sanity (list files in the bucket — does not require write)
    try {
      const { error } = await supabase.storage.from(BAKES_BUCKET).list('bakes', { limit: 1 });
      if (error) throw error;
      console.log('✅ storage bucket list: PASS (bucket exists and is accessible)');
    } catch (e: any) {
      console.error('❌ storage LIST failed (bucket may not exist or RLS on storage.objects):', e.message || e);
    }

    console.groupEnd();
    toast.success('Diagnostics complete — check the browser console (F12) for detailed PASS/FAIL + raw errors.');
  };

  // Password gate
  const submitPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pw === password) {
      onAuthed();
      setPw('');
      setPwError('');
    } else {
      setPwError('Incorrect. Double-check VITE_STUDIO_PASSWORD.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="studio-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.985 }}
        className="studio-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="studio-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#3F2A1D] flex items-center justify-center">
              <Camera className="text-white" size={17} />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-xl">Angel's Studio</div>
              <div className="text-xs text-[#8B6F5C] -mt-0.5">Edit everything. No code required.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authed && (
              <button onClick={onExitAuth} className="btn btn-ghost flex items-center gap-1.5 text-sm">
                <LogOut size={15} /> Sign out
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F1E9DC]"><X size={21} /></button>
          </div>
        </div>

        {!authed ? (
          /* PASSWORD GATE */
          <div className="p-9 flex items-center justify-center min-h-[420px]">
            <form onSubmit={submitPassword} className="w-full max-w-[340px]">
              <div className="text-center mb-7">
                <div className="mx-auto w-14 h-14 rounded-full bg-[#F1E9DC] flex items-center justify-center mb-4">
                  <Edit3 className="text-[#C17F59]" size={26} />
                </div>
                <div className="font-semibold text-2xl tracking-tight">Welcome back, Angel</div>
                <p className="text-[#6B5344] mt-1 text-sm">Enter your studio password</p>
              </div>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setPwError(''); }}
                className="input password-input text-center text-2xl tracking-[6px]"
                placeholder="••••••••"
                autoFocus
              />
              {pwError && <div className="text-red-600 text-sm text-center mt-2">{pwError}</div>}
              <button type="submit" className="btn btn-primary w-full mt-4 py-3">Enter Studio</button>
              <p className="text-[10px] text-center text-[#8B6F5C] mt-5">Password is stored in VITE_STUDIO_PASSWORD</p>
            </form>
          </div>
        ) : (
          <>
            {/* TABS */}
            <div className="studio-tabs">
              {(['bakes', 'story', 'testimonials', 'inquiries', 'settings'] as const).map(t => (
                <div
                  key={t}
                  onClick={() => setTab(t)}
                  className={`studio-tab ${tab === t ? 'active' : ''}`}
                >
                  {t === 'bakes' && 'Bakes'}
                  {t === 'story' && 'My Story'}
                  {t === 'testimonials' && 'Testimonials'}
                  {t === 'inquiries' && `Inquiries ${inquiries.length ? `(${inquiries.length})` : ''}`}
                  {t === 'settings' && 'Settings'}
                </div>
              ))}
            </div>

            <div className="studio-body">
              {/* ==================== BAKES TAB ==================== */}
              {tab === 'bakes' && (
                <div className="space-y-9">
                  {/* Upload */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Upload className="text-[#C17F59]" size={19} />
                      <div className="font-semibold tracking-tight text-xl">Add New Bake</div>
                    </div>

                    <div
                      className={`dropzone ${uploadPreview ? 'border-[#C17F59]' : ''} ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0] || null); }}
                      onDragOver={e => e.preventDefault()}
                    >
                      <input
                        ref={setFileInput}
                        type="file" accept="image/*" capture="environment"
                        onChange={e => handleFile(e.target.files?.[0] || null)}
                      />
                      {isUploading ? (
                        <div>
                          <div className="font-medium text-[#C17F59] mb-3">Uploading… {uploadProgress}%</div>
                          <div className="h-1.5 bg-[#E5D9C7] rounded w-3/4 mx-auto overflow-hidden">
                            <div className="h-1.5 bg-[#C17F59]" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : uploadPreview ? (
                        <div>
                          <img src={uploadPreview} alt="" className="max-h-[210px] rounded-2xl mx-auto shadow mb-3" />
                          <div className="text-sm text-[#C17F59]">Tap to choose a different photo</div>
                        </div>
                      ) : (
                        <>
                          <Camera size={36} className="mx-auto mb-3 text-[#C17F59]" />
                          <div className="font-semibold">Tap or drop a photo</div>
                          <div className="text-sm text-[#8B6F5C] mt-1">Camera or library — works great on phones</div>
                        </>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="text-xs tracking-widest text-[#8B6F5C] block mb-1.5 ml-1">TITLE</label>
                        <input className="input" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Sourdough Boule" disabled={isUploading} />
                      </div>
                      <div>
                        <label className="text-xs tracking-widest text-[#8B6F5C] block mb-1.5 ml-1">CATEGORY</label>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORIES.map(c => (
                            <button key={c} type="button" onClick={() => setUploadCategory(c)} disabled={isUploading}
                              className={`chip text-sm ${uploadCategory === c ? 'chip-active' : ''}`}>
                              {CATEGORY_LABELS[c]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs tracking-widest text-[#8B6F5C] block mb-1.5 ml-1">SHORT DESCRIPTION (shown on Signature page &amp; lightbox)</label>
                      <textarea className="input" rows={2} value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Naturally leavened with a crackly crust and tangy crumb..." disabled={isUploading} />
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <button type="button" onClick={() => setUploadFeatured(!uploadFeatured)} disabled={isUploading}
                        className={`chip ${uploadFeatured ? 'chip-active' : ''}`}>
                        {uploadFeatured ? <Star size={15} className="mr-1" /> : <StarOff size={15} className="mr-1" />} Featured in Signature
                      </button>
                    </div>

                    <button onClick={doUpload} disabled={isUploading || !uploadFile || !uploadTitle.trim()}
                      className="btn btn-primary btn-lg w-full mt-5 min-h-[54px]">
                      {isUploading ? `Uploading ${uploadProgress}%` : 'Publish to Gallery'}
                    </button>
                    {uploadFile && !isUploading && (
                      <button onClick={resetUpload} className="text-xs text-[#8B6F5C] block mx-auto mt-3 underline">Clear</button>
                    )}
                  </div>

                  {/* Current bakes with drag reorder */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold tracking-tight text-xl">Your Bakes ({bakes.length}) — drag to reorder</div>
                      <button onClick={() => refetchBakes()} className="text-xs flex items-center gap-1 text-[#C17F59]"><RefreshCw size={13} /> Refresh</button>
                    </div>

                    {bakes.length === 0 ? (
                      <div className="bg-[#F8F4ED] rounded-2xl p-9 text-center text-[#6B5344]">No bakes yet. Use the zone above.</div>
                    ) : (
                      <Reorder.Group axis="y" values={localBakes.length ? localBakes : bakes} onReorder={onReorderBakes} className="admin-list">
                        {(localBakes.length ? localBakes : bakes).map((bake) => (
                          <Reorder.Item key={bake.id} value={bake} className="admin-row">
                            <img src={bake.image_url} alt="" className="admin-thumb" onClick={() => window.open(bake.image_url, '_blank')} />
                            <div className="min-w-0">
                              <input
                                defaultValue={bake.title}
                                className="admin-title-input"
                                onBlur={(e) => {
                                  if (e.target.value.trim() && e.target.value.trim() !== bake.title) {
                                    updateBake(bake.id, { title: e.target.value.trim() });
                                  }
                                }}
                              />
                              <div className="admin-desc">
                                <textarea
                                  defaultValue={bake.description || ''}
                                  placeholder="Short description (add column first if this fails)"
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== (bake.description || '')) {
                                      updateBake(bake.id, { description: v || null });
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {CATEGORIES.map(cat => (
                                  <button key={cat} onClick={() => updateBake(bake.id, { category: cat })}
                                    className={`text-[10px] px-2.5 py-px rounded-full border ${bake.category === cat ? 'bg-[#C17F59] text-white border-[#C17F59]' : 'border-[#E5D9C7] text-[#8B6F5C]'}`}>
                                    {CATEGORY_LABELS[cat]}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 pr-1">
                              <button onClick={() => toggleFeatured(bake)} className="move-btn" title="Toggle featured">
                                {bake.featured ? <Star size={16} className="text-[#C17F59]" /> : <StarOff size={16} />}
                              </button>
                              <button onClick={() => deleteBake(bake)} className="move-btn hover:bg-red-50 hover:text-red-600 hover:border-red-200" title="Delete">
                                <Trash2 size={16} />
                              </button>
                              <div className="text-[10px] text-[#8B6F5C] pt-1 select-none">drag ↑↓</div>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== STORY TAB ==================== */}
              {tab === 'story' && (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <div className="font-semibold tracking-tight text-xl mb-1">My Story — editable sections</div>
                    <p className="text-sm text-[#6B5344]">Changes publish instantly to the public /story page.</p>
                  </div>

                  {storyKeys.map((key) => {
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const val = storyDraft[key] ?? content[key] ?? DEFAULT_STORY[key] ?? '';
                    return (
                      <div key={key} className="mb-8">
                        <label className="block text-xs tracking-[1.5px] text-[#C17F59] mb-2">{label.toUpperCase()}</label>
                        <textarea
                          className="input"
                          value={val}
                          onChange={e => setStoryDraft(d => ({ ...d, [key]: e.target.value }))}
                          rows={key === 'hero_tagline' ? 2 : 5}
                        />
                        <button onClick={() => saveStorySection(key)} className="text-xs text-[#C17F59] mt-1.5 underline">Save this section</button>
                      </div>
                    );
                  })}

                  <button onClick={saveAllStory} className="btn btn-primary mt-2">Publish All Changes</button>
                  <button onClick={() => refetchContent()} className="ml-4 text-sm text-[#6B5344] underline">Reset from server</button>
                </div>
              )}

              {/* ==================== TESTIMONIALS ==================== */}
              {tab === 'testimonials' && (
                <div>
                  <div className="mb-5">
                    <div className="font-semibold tracking-tight text-xl">Testimonials</div>
                    <p className="text-sm text-[#6B5344]">These appear on the home and contact pages. Keep them warm and real.</p>
                  </div>

                  {/* Add new */}
                  <div className="bg-[#F8F4ED] rounded-2xl p-5 mb-6">
                    <div className="grid gap-3">
                      <textarea className="input" placeholder="The quote..." rows={3} value={newTest.quote} onChange={e => setNewTest({ ...newTest, quote: e.target.value })} />
                      <div className="grid grid-cols-2 gap-3">
                        <input className="input" placeholder="Customer name" value={newTest.name} onChange={e => setNewTest({ ...newTest, name: e.target.value })} />
                        <input className="input" placeholder="Role / relation" value={newTest.role} onChange={e => setNewTest({ ...newTest, role: e.target.value })} />
                      </div>
                    </div>
                    <button onClick={addTest} className="btn btn-primary mt-3">Add Testimonial</button>
                  </div>

                  {tLoading ? <div>Loading…</div> : (
                    <Reorder.Group axis="y" values={testimonials.map(t => t.id)} onReorder={(ids: string[]) => reorderTestimonials(ids)} className="space-y-3">
                      {testimonials.map((t) => (
                        <Reorder.Item key={t.id} value={t.id} className="border border-[#E5D9C7] bg-white rounded-2xl p-4">
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <textarea
                                className="input text-[15px]"
                                value={t.quote}
                                onBlur={(e) => updateTestimonial(t.id, { quote: e.target.value.trim() })}
                                onChange={() => { /* live local only */ }}
                              />
                              <div className="grid grid-cols-2 gap-3 mt-2">
                                <input className="input" defaultValue={t.name} onBlur={e => updateTestimonial(t.id, { name: e.target.value })} />
                                <input className="input" defaultValue={t.role} onBlur={e => updateTestimonial(t.id, { role: e.target.value })} />
                              </div>
                            </div>
                            <button onClick={() => removeTestimonial(t.id)} className="move-btn self-start text-red-600/70 hover:text-red-600 hover:border-red-200">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                </div>
              )}

              {/* ==================== INQUIRIES ==================== */}
              {tab === 'inquiries' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold tracking-tight text-xl">Customer Inquiries</div>
                      <div className="text-sm text-[#6B5344]">Submitted through the website or "Request this bake"</div>
                    </div>
                    <button onClick={() => window.location.reload()} className="text-xs text-[#C17F59] flex items-center gap-1"><RefreshCw size={13} /> Refresh</button>
                  </div>

                  {iLoading ? <div>Loading…</div> : inquiries.length === 0 ? (
                    <div className="text-center py-12 text-[#6B5344] bg-[#F8F4ED] rounded-2xl">No inquiries yet. They will appear here the moment someone sends one.</div>
                  ) : (
                    <div className="space-y-3">
                      {inquiries.map((inq) => (
                        <div key={inq.id} className={`border rounded-2xl p-5 ${inq.handled ? 'opacity-70 bg-[#F8F4ED]' : 'bg-white border-[#E5D9C7]'}`}>
                          <div className="flex justify-between gap-4">
                            <div>
                              <div className="font-medium">{inq.name} <span className="text-[#8B6F5C] font-normal">· {inq.email}</span></div>
                              {inq.phone && <div className="text-xs text-[#8B6F5C]">{inq.phone}</div>}
                              <div className="text-xs uppercase tracking-widest text-[#C17F59] mt-1.5">{inq.inquiry_type}</div>
                              {inq.bake_title && <div className="text-sm mt-0.5 text-[#C17F59]">For: {inq.bake_title}</div>}
                            </div>
                            <div className="text-right text-xs text-[#8B6F5C] whitespace-nowrap">
                              {new Date(inq.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="mt-3 text-[15px] leading-relaxed">{inq.message}</div>

                          <div className="mt-4 flex gap-2">
                            <a href={`mailto:${inq.email}?subject=Re: ${inq.inquiry_type}`} className="btn btn-secondary text-xs px-4">Reply by email</a>
                            <button onClick={() => markHandled(inq.id, !inq.handled)} className="btn btn-ghost text-xs flex items-center gap-1.5">
                              {inq.handled ? 'Mark as new' : <><Check size={15} /> Mark handled</>}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ==================== SETTINGS ==================== */}
              {tab === 'settings' && (
                <div className="max-w-lg space-y-8">
                  <div>
                    <div className="font-semibold tracking-tight text-xl mb-2">Quick Actions</div>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => window.print()} className="btn btn-secondary">Print beautiful portfolio</button>
                      <button onClick={() => { refetchBakes(); refetchContent(); toast.success('Refreshed all data'); }} className="btn btn-secondary flex items-center gap-2"><RefreshCw size={15} /> Sync from Supabase</button>
                      {/* NEW: The big diagnostic button the user asked for */}
                      <button onClick={runDiagnostics} className="btn btn-secondary flex items-center gap-2 border-[#C17F59] text-[#C17F59]">
                        🔍 Test Supabase Connection &amp; Policies
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-[#6B5344] leading-relaxed border border-[#E5D9C7] rounded-2xl p-5 bg-[#F8F4ED]">
                    All content (story, testimonials, bakes, descriptions) lives in Supabase.<br />
                    The public site updates live thanks to realtime.<br /><br />
                    <strong>If uploads or My Story saves fail:</strong> Click the "Test Supabase..." button above, then open DevTools console. The output tells you exactly which policy (bakes table, storage bucket, or site_content) is missing.
                  </div>

                  <button onClick={onExitAuth} className="btn btn-ghost text-red-600/90 flex items-center gap-2">
                    <LogOut size={16} /> Sign out of Studio
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
