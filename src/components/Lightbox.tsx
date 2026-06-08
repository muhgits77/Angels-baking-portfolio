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
          <div className="lightbox-img-wrap relative">
            <img
              src={bake.image_url}
              alt={bake.title}
              className="select-none"
            />
            {/* Subtle inner vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.35)' }} />
          </div>

          <div className="lightbox-meta">
            <div className="left">
              <div className="title tracking-[-0.3px]">{bake.title}</div>
              <div className="category">{label}</div>
              {bake.description && (
                <div className="desc">{bake.description}</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <button
                onClick={() => onRequest(bake)}
                className="btn btn-primary text-sm px-6 flex items-center gap-2"
              >
                <Heart size={15} /> Request this bake
              </button>
              <div className="text-[10px] text-[#C9B39E] tracking-widest">ESC TO CLOSE • ← → NAVIGATE • O TO ORDER</div>
            </div>
          </div>

          {/* Controls */}
          <button className="lightbox-close" onClick={onClose} aria-label="Close lightbox">
            <X size={22} />
          </button>
          {allBakes.length > 1 && (
            <>
              <button className="lightbox-nav prev" onClick={goPrev} aria-label="Previous">
                <ChevronLeft size={22} />
              </button>
              <button className="lightbox-nav next" onClick={goNext} aria-label="Next">
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
