/**
 * Angel's Baking Portfolio
 *
 * Supabase edition — clean, production-ready single-page portfolio.
 *
 * - All data lives in Supabase (public.bakes table + public 'bakes' storage bucket).
 * - No localStorage fallback whatsoever. Every read/write goes through Supabase.
 * - Supabase client is created lazily and ONLY in the browser (SSR-safe, works with TanStack Start, Next.js, etc.).
 * - Full realtime via postgres_changes — gallery and Studio update live.
 * - Studio is password-protected using VITE_STUDIO_PASSWORD (simple client-side gate).
 * - Full mobile-first CRUD:
 *     • Upload photos directly from phone camera or library
 *     • Edit title, category, featured flag
 *     • Reorder via up/down (updates display_order)
 *     • Delete (removes both row and storage object)
 * - Warm, premium bakery aesthetic (unchanged from design system).
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   VITE_STUDIO_PASSWORD
 *
 * Uses the project: https://nikppnqnwtwgwzfktzuu.supabase.co
 */

import { useState, useMemo, useRef } from 'react';
import { 
  Camera, X, ArrowUp, ArrowDown, Trash2, Star, StarOff, 
  Upload, LogOut, Edit3, Menu 
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import { 
  getSupabase, 
  type Bake, 
  CATEGORIES, 
  CATEGORY_LABELS, 
  STUDIO_PASSWORD,
  isSupabaseConfigured,
  BAKES_TABLE,
  BAKES_BUCKET 
} from './lib/supabase';
import { useBakes } from './hooks/useBakes';

// ============================================
// CONFIG — Easy to customize
// ============================================
const SITE = {
  name: "Angel's Baking",
  tagline: "Handcrafted with love, baked with joy",
  about: "Hi, I'm Angel. I bake because it brings people together. Every loaf, cake, and pastry is made by hand with the best ingredients I can find — butter, flour, seasonal fruit, and a whole lot of care. From crusty sourdoughs to delicate pastries, everything that leaves my kitchen is meant to be shared and savored.",
  contactEmail: "hello@angelsbaking.com",
  instagram: "@angelsbaking",
};

// ============================================
// TYPES
// ============================================
type FilterCategory = 'all' | (typeof CATEGORIES)[number];

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const { bakes, loading, error, refetch } = useBakes();

  // Studio state (in-memory only — no persistence required for admin session)
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioAuthed, setStudioAuthed] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Gallery
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [lightboxBake, setLightboxBake] = useState<Bake | null>(null);

  // Studio upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<(typeof CATEGORIES)[number]>('pastries');
  const [uploadFeatured, setUploadFeatured] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Mobile nav
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // DERIVED DATA
  // ============================================
  const filteredBakes = useMemo(() => {
    if (activeFilter === 'all') return bakes;
    return bakes.filter((b) => b.category === activeFilter);
  }, [bakes, activeFilter]);

  const signatureBakes = useMemo(() => {
    return bakes.filter((b) => b.featured).slice(0, 6);
  }, [bakes]);

  // ============================================
  // STUDIO AUTH
  // ============================================
  const openStudio = () => {
    if (!isSupabaseConfigured()) {
      toast.error(
        'Supabase not configured. In Vercel: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Environment Variables, then redeploy. ' +
        'Locally: check your .env file.'
      );
      return;
    }
    setIsStudioOpen(true);
    setMobileMenuOpen(false);
    if (!studioAuthed) {
      setPasswordInput('');
      setPasswordError('');
    }
  };

  const closeStudio = () => {
    setIsStudioOpen(false);
    // Reset upload form on close for cleanliness
    resetUploadForm();
  };

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!STUDIO_PASSWORD) {
      setPasswordError(
        'No studio password configured. Set VITE_STUDIO_PASSWORD in your .env (local) or Vercel Environment Variables, then restart/redeploy.'
      );
      return;
    }
    
    if (passwordInput === STUDIO_PASSWORD) {
      setStudioAuthed(true);
      setPasswordError('');
      setPasswordInput('');
      toast.success('Welcome to the studio');
    } else {
      setPasswordError('Incorrect password. Double-check VITE_STUDIO_PASSWORD in Vercel env vars or .env.');
      toast.error('Incorrect password');
    }
  };

  const exitStudioAuth = () => {
    setStudioAuthed(false);
    setPasswordInput('');
    setPasswordError('');
    closeStudio();
  };

  // ============================================
  // UPLOAD + CRUD — All operations go directly to Supabase
  // Table: public.bakes | Storage: public 'bakes' bucket
  // No localStorage. Realtime keeps UI in sync.
  // ============================================
  const resetUploadForm = () => {
    setUploadFile(null);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(null);
    setUploadTitle('');
    setUploadCategory('pastries');
    setUploadFeatured(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    // Reasonable size limit for mobile uploads (15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image is too large. Please keep it under 15MB.');
      return;
    }

    // Clean previous preview
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);

    const previewUrl = URL.createObjectURL(file);
    setUploadFile(file);
    setUploadPreview(previewUrl);

    // Smart default title from filename
    if (!uploadTitle) {
      const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadTitle(base.charAt(0).toUpperCase() + base.slice(1));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  /**
   * Upload a new bake photo (mobile-optimized).
   * 1. Upload file to Supabase Storage (bakes bucket) → get public URL + storage_path
   * 2. Insert row into bakes table with next display_order
   * 3. Realtime will push the new row into the UI automatically.
   */
  const uploadBake = async () => {
    if (!uploadFile) {
      toast.error('Please choose a photo first');
      return;
    }
    if (!uploadTitle.trim()) {
      toast.error('Please give your bake a title');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const supabase = getSupabase();

      // 1. Upload the image to the public 'bakes' storage bucket
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const storagePath = `bakes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BAKES_BUCKET)
        .upload(storagePath, uploadFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setUploadProgress(55);

      // 2. Get the permanent public URL
      const { data: publicUrlData } = supabase.storage
        .from(BAKES_BUCKET)
        .getPublicUrl(storagePath);

      const imageUrl = publicUrlData.publicUrl;
      if (!imageUrl) throw new Error('Failed to obtain public URL for uploaded image');

      // 3. Determine next display order (append to end)
      const maxOrder = bakes.length > 0
        ? Math.max(...bakes.map((b) => b.display_order))
        : -1;

      // 4. Insert the metadata row. Realtime subscription will deliver it to the UI.
      const { error: insertError } = await supabase.from(BAKES_TABLE).insert({
        title: uploadTitle.trim(),
        category: uploadCategory,
        image_url: imageUrl,
        storage_path: storagePath,
        display_order: maxOrder + 1,
        featured: uploadFeatured,
      });

      if (insertError) {
        // Attempt to clean up the orphaned storage object
        await supabase.storage.from(BAKES_BUCKET).remove([storagePath]).catch(() => {});
        throw insertError;
      }

      setUploadProgress(100);
      toast.success('Photo added to the gallery!');

      resetUploadForm();

      // Safety refetch (realtime usually handles it, but this is robust)
      setTimeout(() => {
        refetch().catch(() => {});
      }, 300);

    } catch (err: any) {
      console.error('[Studio] Upload failed:', err);

      const friendly =
        err.message ||
        'Upload failed. Common fixes:\n' +
        '• VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set correctly in Vercel Environment Variables (or local .env)\n' +
        '• "bakes" storage bucket exists and is PUBLIC in Supabase Dashboard\n' +
        '• RLS policies on bakes table and storage bucket allow insert for the anon role\n' +
        '• You are on a stable network (mobile data sometimes works better than VPN)\n\n' +
        'Check browser console for the full error.';

      toast.error(friendly, { duration: 8000 });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Update title inline in Studio (direct Supabase update + realtime)
  const updateTitle = async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from(BAKES_TABLE)
        .update({ title: trimmed })
        .eq('id', id);

      if (error) throw error;
      // Realtime will update the list automatically
    } catch (err: any) {
      toast.error(
        'Failed to update title. ' +
        'Check that VITE_SUPABASE_* are set in Vercel env vars and the table RLS policies allow updates.'
      );
      console.error(err);
    }
  };

  // Update category (direct + realtime)
  const updateCategory = async (id: string, newCategory: (typeof CATEGORIES)[number]) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from(BAKES_TABLE)
        .update({ category: newCategory })
        .eq('id', id);

      if (error) throw error;
      toast.success('Category updated');
    } catch (err: any) {
      toast.error(
        'Failed to update category. Verify Supabase config in Vercel and that RLS policies permit updates on the bakes table.'
      );
      console.error(err);
    }
  };

  // Toggle featured flag (direct + realtime)
  const toggleFeatured = async (bake: Bake) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from(BAKES_TABLE)
        .update({ featured: !bake.featured })
        .eq('id', bake.id);

      if (error) throw error;
      // Star visual + realtime is enough feedback
    } catch (err) {
      toast.error(
        'Failed to toggle featured. Check Supabase connection (Vercel env vars + table policies).'
      );
      console.error(err);
    }
  };

  /**
   * Reorder using a full re-sequence of display_order.
   * This is the most reliable way to handle ordering without race conditions.
   */
  const moveBake = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = bakes.findIndex((b) => b.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= bakes.length) return;

    const newOrder = [...bakes];
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];

    // Re-assign sequential display_order values 0..n
    const updates = newOrder.map((bake, index) => ({
      id: bake.id,
      display_order: index,
    }));

    try {
      const supabase = getSupabase();

      // Update all affected rows. Realtime will reflect the new order.
      await Promise.all(
        updates.map((u) =>
          supabase
            .from(BAKES_TABLE)
            .update({ display_order: u.display_order })
            .eq('id', u.id)
        )
      );
    } catch (err) {
      toast.error(
        'Failed to reorder. This usually means a Supabase connection or RLS policy issue. ' +
        'Check VITE_SUPABASE_* vars in Vercel and table policies.'
      );
      console.error(err);
      refetch().catch(() => {});
    }
  };

  /**
   * Delete a bake: remove the DB row + the storage object.
   * Realtime will remove it from the list.
   */
  const deleteBake = async (bake: Bake) => {
    if (!confirm(`Delete "${bake.title}"? This cannot be undone.`)) return;

    try {
      const supabase = getSupabase();

      const { error: dbError } = await supabase
        .from(BAKES_TABLE)
        .delete()
        .eq('id', bake.id);

      if (dbError) throw dbError;

      if (bake.storage_path) {
        await supabase.storage
          .from(BAKES_BUCKET)
          .remove([bake.storage_path])
          .catch(() => {});
      }

      toast.success('Photo deleted');
    } catch (err: any) {
      toast.error(
        'Failed to delete. Check Supabase URL/anon key in Vercel env vars and that storage + table policies allow deletes.'
      );
      console.error(err);
    }
  };

  // ============================================
  // LIGHTBOX
  // ============================================
  const openLightbox = (bake: Bake) => setLightboxBake(bake);
  const closeLightbox = () => setLightboxBake(null);

  // ============================================
  // RENDER HELPERS
  // ============================================
  const CategoryChips = ({ current, onChange }: { current: FilterCategory; onChange: (c: FilterCategory) => void }) => (
    <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
      {(['all', ...CATEGORIES] as const).map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`chip ${current === cat ? 'chip-active' : ''}`}
        >
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-[#F8F4ED] text-[#3F2A1D]">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#C17F59] flex items-center justify-center">
                <span className="text-white text-lg">🥐</span>
              </div>
              <div>
                <div className="font-semibold tracking-tight text-xl" style={{ fontFamily: 'var(--font-serif)' }}>
                  {SITE.name}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#about" className="hover:text-[#C17F59] transition-colors">About</a>
            <a href="#signature" className="hover:text-[#C17F59] transition-colors">Signature</a>
            <a href="#gallery" className="hover:text-[#C17F59] transition-colors">Gallery</a>
            <a href="#contact" className="hover:text-[#C17F59] transition-colors">Contact</a>
            <button 
              onClick={openStudio}
              className="btn btn-primary text-sm px-5 py-2 flex items-center gap-2"
            >
              <Edit3 size={16} /> Studio
            </button>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={openStudio}
              className="btn btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5"
            >
              <Camera size={16} /> Studio
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-[#E5D9C7] bg-[#F8F4ED]"
            >
              <div className="px-5 py-4 flex flex-col gap-3 text-sm">
                <a href="#about" onClick={() => setMobileMenuOpen(false)} className="py-1">About</a>
                <a href="#signature" onClick={() => setMobileMenuOpen(false)} className="py-1">Signature</a>
                <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="py-1">Gallery</a>
                <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-1">Contact</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/70 text-[#C17F59] text-xs tracking-[2px] font-medium">
            EST. WITH LOVE
          </div>
          <h1 className="mb-4">{SITE.name}</h1>
          <p className="text-xl md:text-2xl text-[#6B5344] mb-10 tracking-tight">
            {SITE.tagline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#gallery" className="btn btn-primary btn-lg">
              Explore the Gallery
            </a>
            <button onClick={openStudio} className="btn btn-secondary btn-lg flex items-center gap-2">
              <Camera size={18} /> Enter Studio
            </button>
          </div>
          <div className="mt-12 text-xs text-[#8B6F5C] tracking-widest">SCROLL TO BEGIN</div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="section container">
        <div className="text-center mb-10">
          <div className="uppercase tracking-[3px] text-xs text-[#C17F59] mb-2">Our Story</div>
          <h2>About Angel's Baking</h2>
        </div>
        <div className="about-card">
          <p className="text-[17px] leading-relaxed text-[#3F2A1D]">{SITE.about}</p>
          <div className="mt-8 pt-6 border-t border-[#E5D9C7] text-sm text-[#6B5344]">
            Everything is baked fresh in small batches. No shortcuts — just real ingredients and time-honored techniques.
          </div>
        </div>
      </section>

      {/* SIGNATURE ITEMS */}
      <section id="signature" className="section bg-[#F1E9DC]">
        <div className="container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="uppercase tracking-[3px] text-xs text-[#C17F59] mb-1">Favorites</div>
              <h2>Signature Items</h2>
            </div>
            <button onClick={() => { setActiveFilter('all'); document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' }); }} className="hidden sm:block btn btn-ghost">
              View all in gallery →
            </button>
          </div>

          {signatureBakes.length > 0 ? (
            <div className="signature-grid">
              {signatureBakes.map((bake) => (
                <div key={bake.id} className="signature-card group cursor-pointer" onClick={() => openLightbox(bake)}>
                  <div className="aspect-[4/3] overflow-hidden bg-[#EDE3D4]">
                    <img 
                      src={bake.image_url} 
                      alt={bake.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-lg tracking-tight">{bake.title}</div>
                        <div className="text-xs uppercase tracking-widest text-[#C17F59] mt-0.5">
                          {CATEGORY_LABELS[bake.category as keyof typeof CATEGORY_LABELS] || bake.category}
                        </div>
                      </div>
                      <Star className="text-[#C17F59]" size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-10 text-center border border-[#E5D9C7]">
              <Star className="mx-auto mb-4 text-[#C17F59]" size={32} />
              <p className="text-[#6B5344]">Signature items will appear here once you mark some photos as featured in the Studio.</p>
              <button onClick={openStudio} className="mt-6 btn btn-secondary">Open Studio</button>
            </div>
          )}
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" className="section container">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="uppercase tracking-[3px] text-xs text-[#C17F59] mb-1">Fresh from the oven</div>
            <h2>The Gallery</h2>
          </div>
          <button onClick={openStudio} className="btn btn-primary self-start sm:self-auto flex items-center gap-2">
            <Upload size={16} /> Add New Photo
          </button>
        </div>

        <CategoryChips current={activeFilter} onChange={setActiveFilter} />

        {/* Status */}
        {error && (
          <div className="my-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error} — <button onClick={refetch} className="underline">Try again</button>
          </div>
        )}

        {loading && bakes.length === 0 ? (
          <div className="masonry pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="masonry-item">
                <div className="bake-card">
                  <div className="aspect-[4/3] skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBakes.length > 0 ? (
          <div className="masonry pt-2">
            {filteredBakes.map((bake) => (
              <div key={bake.id} className="masonry-item">
                <div className="bake-card group" onClick={() => openLightbox(bake)}>
                  <img 
                    src={bake.image_url} 
                    alt={bake.title} 
                    loading="lazy"
                    className="w-full"
                  />
                  <div className="overlay">
                    <div className="title">{bake.title}</div>
                    <div className="category">{CATEGORY_LABELS[bake.category as keyof typeof CATEGORY_LABELS] || bake.category}</div>
                  </div>
                  {bake.featured && (
                    <div className="absolute top-3 right-3 bg-white/95 text-[#C17F59] rounded-full p-1.5 shadow">
                      <Star size={14} fill="currentColor" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-[#E5D9C7] rounded-2xl bg-white mt-2">
            <Camera className="mx-auto text-[#C17F59] mb-4" size={36} />
            <p className="text-[#6B5344] mb-2">No photos yet in this category.</p>
            <button onClick={openStudio} className="btn btn-primary mt-2">Upload your first bake</button>
          </div>
        )}
      </section>

      {/* TESTIMONIALS */}
      <section className="section bg-[#F1E9DC]">
        <div className="container">
          <div className="text-center mb-10">
            <div className="uppercase tracking-[3px] text-xs text-[#C17F59] mb-1">Loved by many</div>
            <h2>From the Table</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { quote: "The sourdough is the best I've had outside of Paris. Crust is perfect, crumb is airy and full of flavor.", name: "Elena M.", role: "Weekly customer" },
              { quote: "Angel's cinnamon rolls are legendary in our house. We order them for every special occasion.", name: "The Rivera Family", role: "Neighbors" },
              { quote: "I brought her almond croissants to a brunch and three people asked for the baker's contact. Incredible.", name: "Marcus T.", role: "Regular at the market" },
            ].map((t, i) => (
              <div key={i} className="testimonial">
                <div className="testimonial-quote mb-6">“{t.quote}”</div>
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-[#8B6F5C]">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section container">
        <div className="max-w-2xl mx-auto">
          <div className="contact-card">
            <h3 className="text-3xl mb-3">Let's bake something together</h3>
            <p className="text-[#EDE3D4] mb-8">For orders, custom cakes, or just to say hello.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href={`mailto:${SITE.contactEmail}`} 
                className="btn bg-white text-[#3F2A1D] hover:bg-[#F8F4ED] px-8"
              >
                Email Angel
              </a>
              <a 
                href={`https://instagram.com/${SITE.instagram.replace('@','')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn border border-white/60 text-white hover:bg-white/10 px-8"
              >
                Follow on Instagram
              </a>
            </div>
            <div className="mt-8 text-sm text-[#C9B39E]">
              {SITE.instagram} · {SITE.contactEmail}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 text-center text-xs text-[#8B6F5C] border-t border-[#E5D9C7]">
        © {new Date().getFullYear()} {SITE.name}. All rights reserved. Baked with ❤️
      </footer>

      {/* ============================================ */}
      {/* STUDIO — Password + Full Admin Interface     */}
      {/* ============================================ */}
      <AnimatePresence>
        {isStudioOpen && (
          <div className="studio-modal" onClick={(e) => { if (e.target === e.currentTarget) closeStudio(); }}>
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.985 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.985 }}
              transition={{ duration: 0.18 }}
              className="studio-panel"
              onClick={e => e.stopPropagation()}
            >
              {/* Studio Header */}
              <div className="studio-header">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#3F2A1D] flex items-center justify-center">
                    <Camera className="text-white" size={16} />
                  </div>
                  <div>
                    <div className="font-semibold tracking-tight">Angel's Studio</div>
                    <div className="text-xs text-[#8B6F5C]">Manage your bakes</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {studioAuthed && (
                    <button onClick={exitStudioAuth} className="btn btn-ghost flex items-center gap-1.5 text-sm">
                      <LogOut size={15} /> Exit
                    </button>
                  )}
                  <button onClick={closeStudio} className="p-2 rounded-full hover:bg-[#F1E9DC]">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Password Gate */}
              {!studioAuthed ? (
                <div className="p-8 flex items-center justify-center min-h-[420px]">
                  <form onSubmit={handlePasswordSubmit} className="password-modal w-full">
                    <div className="text-center mb-6">
                      <div className="mx-auto w-12 h-12 rounded-full bg-[#F1E9DC] flex items-center justify-center mb-4">
                        <Edit3 className="text-[#C17F59]" />
                      </div>
                      <div className="font-semibold text-xl tracking-tight">Enter the Studio</div>
                      <p className="text-[#6B5344] text-sm mt-1">This area is for Angel only.</p>
                    </div>

                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
                      placeholder="••••••••"
                      className="input password-input mb-3"
                      autoFocus
                    />
                    {passwordError && <div className="text-red-600 text-sm text-center mb-3">{passwordError}</div>}

                    <button type="submit" className="btn btn-primary w-full mt-1">Enter Studio</button>
                    <p className="text-[10px] text-center text-[#8B6F5C] mt-4">Password is set via VITE_STUDIO_PASSWORD</p>
                  </form>
                </div>
              ) : (
                /* AUTHENTICATED STUDIO */
                <div className="studio-body">
                  {/* Upload Section */}
                  <div className="mb-9">
                    <div className="flex items-center gap-2 mb-3">
                      <Upload size={18} className="text-[#C17F59]" />
                      <div className="font-semibold tracking-tight text-lg">Add New Bake</div>
                    </div>

                    <div 
                      className={`dropzone mb-4 ${uploadPreview ? 'border-[#C17F59]' : ''} ${isUploading ? 'opacity-75 pointer-events-none' : ''}`}
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                    >
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      />
                      
                      {isUploading ? (
                        <div className="flex flex-col items-center py-4">
                          <div className="text-[#C17F59] font-medium mb-2">Uploading to Supabase… {uploadProgress}%</div>
                          {/* Simple accessible progress bar */}
                          <div className="w-4/5 h-2.5 bg-[#E5D9C7] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#C17F59] transition-all duration-200" 
                              style={{ width: `${uploadProgress}%` }} 
                            />
                          </div>
                          <div className="text-xs text-[#8B6F5C] mt-2">Please keep this tab open</div>
                        </div>
                      ) : uploadPreview ? (
                        <div className="flex flex-col items-center">
                          <img src={uploadPreview} alt="preview" className="max-h-64 rounded-xl mb-3 shadow" />
                          <div className="text-sm text-[#C17F59]">Tap to choose a different photo</div>
                        </div>
                      ) : (
                        <>
                          <Camera className="mx-auto mb-3 text-[#C17F59]" size={32} />
                          <div className="font-medium">Tap or drop a photo here</div>
                          <div className="text-sm text-[#8B6F5C] mt-1">
                            On phone: opens camera or photo library (large tap target)
                          </div>
                        </>
                      )}
                    </div>

                    {/* Upload form fields — very mobile friendly */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs tracking-widest text-[#8B6F5C] mb-1.5 ml-1">TITLE</label>
                        <input 
                          value={uploadTitle} 
                          onChange={(e) => setUploadTitle(e.target.value)} 
                          placeholder="Sourdough Boule" 
                          className="input" 
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-xs tracking-widest text-[#8B6F5C] mb-1.5 ml-1">CATEGORY</label>
                        <div className="category-select">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setUploadCategory(cat)}
                              className={`chip text-sm ${uploadCategory === cat ? 'chip-active' : ''}`}
                              disabled={isUploading}
                            >
                              {CATEGORY_LABELS[cat]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button 
                        type="button"
                        onClick={() => setUploadFeatured(!uploadFeatured)}
                        className={`chip ${uploadFeatured ? 'chip-active' : ''}`}
                        disabled={isUploading}
                      >
                        {uploadFeatured ? <Star size={15} className="mr-1" /> : <StarOff size={15} className="mr-1" />}
                        Featured in Signature Items
                      </button>
                    </div>

                    <button 
                      onClick={uploadBake} 
                      disabled={isUploading || !uploadFile || !uploadTitle.trim()}
                      className="btn btn-primary btn-lg w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-70 min-h-[52px] text-base"
                    >
                      {isUploading ? (
                        <>Uploading to Supabase… {uploadProgress}%</>
                      ) : (
                        <>Publish to Gallery</>
                      )}
                    </button>

                    <div className="text-[11px] text-center text-[#8B6F5C] mt-2">
                      Works best on mobile data or good Wi-Fi. Large button for easy thumb tap.
                    </div>

                    {uploadFile && !isUploading && (
                      <button 
                        onClick={resetUploadForm} 
                        className="text-xs text-[#8B6F5C] mx-auto block mt-2 underline active:text-[#C17F59]"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>

                  {/* Current Bakes — Full management */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold tracking-tight text-lg">Your Bakes ({bakes.length})</div>
                      <button onClick={() => refetch()} className="text-xs text-[#C17F59] underline">Refresh</button>
                    </div>

                    {bakes.length === 0 ? (
                      <div className="bg-[#F8F4ED] rounded-xl p-8 text-center text-sm text-[#6B5344]">
                        No photos yet. Use the uploader above to get started.
                      </div>
                    ) : (
                      <div className="border border-[#E5D9C7] rounded-2xl overflow-hidden bg-white">
                        {bakes.map((bake, index) => (
                          <div key={bake.id} className="admin-row">
                            {/* Thumb */}
                            <img 
                              src={bake.image_url} 
                              alt="" 
                              className="admin-thumb cursor-pointer" 
                              onClick={() => openLightbox(bake)} 
                            />

                            {/* Title + Category (editable) */}
                            <div className="min-w-0 pr-2">
                              <input
                                defaultValue={bake.title}
                                className="admin-title-input"
                                onBlur={(e) => {
                                  if (e.target.value.trim() !== bake.title) {
                                    updateTitle(bake.id, e.target.value);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                              />
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {CATEGORIES.map((cat) => (
                                  <button
                                    key={cat}
                                    onClick={() => updateCategory(bake.id, cat)}
                                    className={`text-[10px] px-2.5 py-px rounded-full border ${bake.category === cat 
                                      ? 'bg-[#C17F59] text-white border-[#C17F59]' 
                                      : 'border-[#E5D9C7] text-[#8B6F5C] hover:border-[#C17F59]'}`}
                                  >
                                    {CATEGORY_LABELS[cat]}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Controls */}
                            <div className="admin-controls pr-2">
                              <button 
                                onClick={() => toggleFeatured(bake)} 
                                className="move-btn" 
                                title={bake.featured ? "Remove from Signature" : "Add to Signature"}
                              >
                                {bake.featured ? <Star size={16} className="text-[#C17F59]" /> : <StarOff size={16} />}
                              </button>

                              <button onClick={() => moveBake(bake.id, 'up')} disabled={index === 0} className="move-btn" title="Move up">
                                <ArrowUp size={16} />
                              </button>
                              <button onClick={() => moveBake(bake.id, 'down')} disabled={index === bakes.length - 1} className="move-btn" title="Move down">
                                <ArrowDown size={16} />
                              </button>

                              <button onClick={() => deleteBake(bake)} className="move-btn hover:bg-red-50 hover:text-red-600 hover:border-red-200" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[10px] text-[#8B6F5C] mt-3 px-1">
                      Tip: Tap the title to rename. Use the arrows to reorder. Changes save instantly to Supabase (realtime updates the gallery too).
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightboxBake && (
          <div className="lightbox" onClick={closeLightbox}>
            <button 
              className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-3" 
              onClick={closeLightbox}
            >
              <X size={28} />
            </button>
            <motion.div 
              initial={{ opacity: 0, scale: 0.985 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
            >
              <img src={lightboxBake.image_url} alt={lightboxBake.title} />
              <div className="text-center mt-4 text-white">
                <div className="font-serif text-2xl tracking-tight">{lightboxBake.title}</div>
                <div className="text-white/70 text-sm mt-0.5 tracking-widest uppercase">
                  {CATEGORY_LABELS[lightboxBake.category as keyof typeof CATEGORY_LABELS] || lightboxBake.category}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
