/**
 * Angel's Baking Portfolio
 * 
 * Vercel Blob Storage edition (clean migration from Supabase).
 * 
 * - All images stored in Vercel Blob (public).
 * - Metadata lives in a single JSON manifest also stored in Vercel Blob (manifest/bakes.json).
 * - Writes go through simple /api/* serverless routes so VERCEL_BLOB_READ_WRITE_TOKEN
 *   never leaves the server.
 * - No Supabase, no realtime, no localStorage for data.
 * - Studio remains fully mobile-friendly with large touch targets.
 * - Gallery + Studio both load data from /api/bakes.
 * 
 * Required env vars (Vercel + local .env):
 *   VERCEL_BLOB_READ_WRITE_TOKEN   (server only — for uploads/deletes)
 *   VITE_STUDIO_PASSWORD           (client — simple password gate)
 */

import { useState, useMemo, useRef } from 'react';
import { 
  Camera, X, ArrowUp, ArrowDown, Trash2, Star, StarOff, 
  Upload, LogOut, Edit3, Menu 
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import type { Bake } from './lib/bakes';
import { 
  CATEGORIES, 
  CATEGORY_LABELS, 
  STUDIO_PASSWORD 
} from './lib/bakes';
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
    // No more Supabase config check — we only need the password client-side.
    // Server-side routes will return clear errors if VERCEL_BLOB_READ_WRITE_TOKEN is missing.
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
      // Development convenience — warn loudly
      setPasswordError('No studio password set. Add VITE_STUDIO_PASSWORD to your environment.');
      return;
    }
    
    if (passwordInput === STUDIO_PASSWORD) {
      setStudioAuthed(true);
      setPasswordError('');
      setPasswordInput('');
      toast.success('Welcome to the studio');
    } else {
      setPasswordError('Incorrect password');
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
  // UPLOAD + CRUD (all go through Vercel Blob via /api routes)
  // No localStorage. Manifest + images live in Blob.
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
   * Upload flow (mobile friendly):
   * 1. POST the raw file to /api/upload (server uses the RW token)
   * 2. Receive public URL + pathname
   * 3. Create a new Bake record client-side
   * 4. Append to current list with next display_order
   * 5. POST the full list to /api/bakes → server writes the manifest JSON
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
    setUploadProgress(10);

    try {
      // 1. Upload the image file via our secure API route
      const formData = new FormData();
      formData.append('file', uploadFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Image upload failed');
      }

      const { url: imageUrl, pathname } = await uploadRes.json();
      setUploadProgress(60);

      if (!imageUrl || !pathname) {
        throw new Error('Invalid response from upload service');
      }

      // 2. Build the new bake record
      const maxOrder = bakes.length > 0
        ? Math.max(...bakes.map((b) => b.display_order))
        : -1;

      const newBake: Bake = {
        id: crypto.randomUUID(),
        title: uploadTitle.trim(),
        category: uploadCategory,
        image_url: imageUrl,
        pathname,
        display_order: maxOrder + 1,
        featured: uploadFeatured,
        created_at: new Date().toISOString(),
      };

      // 3. Optimistic new list + persist via manifest
      const updatedList = [...bakes, newBake];

      const saveRes = await fetch('/api/bakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bakes: updatedList }),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save to gallery');
      }

      setUploadProgress(100);
      toast.success('Photo added to the gallery!');

      resetUploadForm();

      // Refresh from source of truth
      await refetch();

    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error(err.message || 'Upload failed. Please try again.');
      // Best effort refresh to stay consistent
      refetch().catch(() => {});
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Persist a new version of the full list to the manifest.
   * Used by all mutations (title, category, reorder, featured, delete).
   */
  const persistBakes = async (newList: Bake[], deletePathnames?: string[]) => {
    try {
      const res = await fetch('/api/bakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bakes: newList, deletePathnames }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save changes');
      }

      // Refresh to get canonical sorted data from the manifest
      await refetch();
      return true;
    } catch (err: any) {
      console.error('persistBakes error:', err);
      toast.error(err.message || 'Failed to save changes');
      // Try to recover latest state
      await refetch().catch(() => {});
      return false;
    }
  };

  // Update title (inline in studio) — optimistic then persist full list
  const updateTitle = async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const updated = bakes.map((b) =>
      b.id === id ? { ...b, title: trimmed } : b
    );

    await persistBakes(updated);
  };

  // Update category
  const updateCategory = async (id: string, newCategory: (typeof CATEGORIES)[number]) => {
    const updated = bakes.map((b) =>
      b.id === id ? { ...b, category: newCategory } : b
    );

    const ok = await persistBakes(updated);
    if (ok) toast.success('Category updated');
  };

  // Toggle featured flag
  const toggleFeatured = async (bake: Bake) => {
    const updated = bakes.map((b) =>
      b.id === bake.id ? { ...b, featured: !b.featured } : b
    );

    await persistBakes(updated);
    // Toast is shown after refetch in persistBakes success path is not needed here
    // because we don't want two toasts. The action is obvious.
  };

  // Reorder using full re-sequence of display_order (very reliable)
  const moveBake = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = bakes.findIndex((b) => b.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= bakes.length) return;

    const newOrder = [...bakes];
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];

    // Re-assign clean sequential order
    const reordered = newOrder.map((bake, index) => ({
      ...bake,
      display_order: index,
    }));

    await persistBakes(reordered);
  };

  // Delete: remove from list + tell server to delete the actual image blob
  const deleteBake = async (bake: Bake) => {
    if (!confirm(`Delete "${bake.title}"? This cannot be undone.`)) return;

    const updated = bakes.filter((b) => b.id !== bake.id);
    const ok = await persistBakes(updated, [bake.pathname]);

    if (ok) {
      toast.success('Photo deleted');
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
                      className={`dropzone mb-4 ${uploadPreview ? 'border-[#C17F59]' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
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
                      
                      {uploadPreview ? (
                        <div className="flex flex-col items-center">
                          <img src={uploadPreview} alt="preview" className="max-h-64 rounded-xl mb-3 shadow" />
                          <div className="text-sm text-[#C17F59]">Tap to choose a different photo</div>
                        </div>
                      ) : (
                        <>
                          <Camera className="mx-auto mb-3 text-[#C17F59]" size={32} />
                          <div className="font-medium">Tap or drop a photo here</div>
                          <div className="text-sm text-[#8B6F5C] mt-1">Works great from your phone camera roll or camera</div>
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
                      className="btn btn-primary btn-lg w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isUploading ? (
                        <>Uploading... {uploadProgress > 0 && `${uploadProgress}%`}</>
                      ) : (
                        <>Publish to Gallery</>
                      )}
                    </button>
                    {uploadFile && (
                      <button onClick={resetUploadForm} className="text-xs text-[#8B6F5C] mx-auto block mt-3 underline">
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
                      Tip: Tap the title to rename. Use the arrows to reorder. Changes save to Vercel Blob instantly.
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
