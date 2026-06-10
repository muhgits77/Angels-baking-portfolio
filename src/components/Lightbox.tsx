import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Bake } from '../lib/supabase';
import { CATEGORY_LABELS } from '../lib/supabase';

interface LightboxProps {
  bake: Bake | null;
  allBakes: Bake[];
  onClose: () => void;
  onNavigate: (bake: Bake) => void;
  onRequest: (bake: Bake) => void;
}

export function Lightbox({ bake, allBakes, onClose, onNavigate, onRequest }: LightboxProps) {
  const currentIndex = bake ? allBakes.findIndex(b => b.id === bake.id) : -1;

  const goPrev = useCallback(() => {
    if (!bake || currentIndex < 0) return;
    const prev = allBakes[(currentIndex - 1 + allBakes.length) % allBakes.length];
    onNavigate(prev);
  }, [bake, currentIndex, allBakes, onNavigate]);

  const goNext = useCallback(() => {
    if (!bake || currentIndex < 0) return;
    const next = allBakes[(currentIndex + 1) % allBakes.length];
    onNavigate(next);
  }, [bake, currentIndex, allBakes, onNavigate]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if ((e.key === 'o' || e.key === 'O') && bake) onRequest(bake);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext, bake, onRequest]);

  // Scroll lock for stable mobile experience + prevent background scroll.
  // On mobile the lightbox-content itself is scrollable (for long descriptions) while body is locked.
  useEffect(() => {
    if (!bake) return;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    document.body.style.overflow = 'hidden';
    // iOS Safari fix for position:fixed + safe areas (keeps carousel stable)
    if (window.innerWidth < 768) {
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth || '';
    };
  }, [bake]);

  // Swipe / drag navigation for smooth carousel feel on mobile (Android friendly)
  const handleDragEnd = useCallback((_: any, info: { offset: { x: number } }) => {
    const threshold = 70;
    if (info.offset.x > threshold) {
      goPrev();
    } else if (info.offset.x < -threshold) {
      goNext();
    }
  }, [goPrev, goNext]);

  if (!bake) return null;

  const label = CATEGORY_LABELS[bake.category as keyof typeof CATEGORY_LABELS] || bake.category;

  return (
    <AnimatePresence>
      <div className="lightbox" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.985, y: 8 }}
          transition={{ duration: 0.16 }}
          className="lightbox-content"
          onClick={e => e.stopPropagation()}
        >
          <div className="lightbox-img-wrap relative overflow-hidden">
            <img
              src={bake.image_url}
              alt={bake.title}
              className="select-none w-full h-auto"
            />
            {/* Subtle inner vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.35)' }} />
            {/* Bottom gradient fade — creates elegant separation between photo and meta title/desc below. Prevents any visual "overlap" feel on mobile. */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[rgba(18,15,12,0.78)] to-transparent pointer-events-none z-[8]" />

            {/* Swipe gesture layer (captures horizontal drags for prev/next; vertical allowed to scroll content if needed) */}
            {allBakes.length > 1 && (
              <motion.div
                className="absolute inset-0 z-[5] touch-pan-y"
                drag="x"
                dragConstraints={{ left: -10, right: 10 }}
                dragElastic={0.08}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                whileDrag={{ cursor: 'grabbing' }}
              />
            )}

            {/* Nav arrows INSIDE image wrap (positioned via CSS relative to this container) so they NEVER overlap the meta/title/desc below */}
            {allBakes.length > 1 && (
              <>
                <button
                  className="lightbox-nav prev"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  aria-label="Previous bake"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  className="lightbox-nav next"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  aria-label="Next bake"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>

          <div className="lightbox-meta">
            <div className="left">
              <div className="title tracking-[-0.3px]">{bake.title}</div>
              <div className="category">{label}</div>
              {bake.description && (
                <div className="desc">{bake.description}</div>
              )}
            </div>
            <div className="lightbox-actions flex flex-col items-end gap-3 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onRequest(bake); }}
                className="btn btn-primary text-sm px-5 sm:px-6 py-2.5 flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <Heart size={15} /> Request this bake
              </button>
              <div className="text-[10px] text-[#C9B39E] tracking-widest hidden sm:block">ESC TO CLOSE • ← → NAVIGATE • O TO ORDER</div>
            </div>
          </div>

          {/* Close always available, top-right over image area */}
          <button className="lightbox-close" onClick={onClose} aria-label="Close lightbox">
            <X size={22} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
