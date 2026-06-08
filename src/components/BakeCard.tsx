import { Star } from 'lucide-react';
import type { Bake } from '../lib/supabase';
import { CATEGORY_LABELS } from '../lib/supabase';

interface BakeCardProps {
  bake: Bake;
  variant?: 'gallery' | 'signature';
  onClick?: () => void;
  onRequest?: () => void;
}

export function BakeCard({ bake, variant = 'gallery', onClick, onRequest }: BakeCardProps) {
  const label = CATEGORY_LABELS[bake.category as keyof typeof CATEGORY_LABELS] || bake.category;

  if (variant === 'signature') {
    return (
      <div className="bake-hero-card group" onClick={onClick}>
        <div className="media">
          <img src={bake.image_url} alt={bake.title} loading="lazy" />
          {bake.featured && (
            <div className="absolute top-3 right-3 bg-white/90 text-[#C17F59] rounded-full p-1.5 shadow">
              <Star size={14} fill="currentColor" />
            </div>
          )}
        </div>
        <div className="meta">
          <div>
            <div className="category">{label}</div>
            <h3 className="tracking-[-0.2px]">{bake.title}</h3>
          </div>
          {bake.description && (
            <p className="desc line-clamp-3">{bake.description}</p>
          )}
          <div className="actions">
            <button
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
              className="btn btn-secondary text-sm px-4 py-1.5 flex-1"
            >
              View details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRequest?.(); }}
              className="btn btn-primary text-sm px-5 py-1.5 flex-1"
            >
              Request this
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gallery compact card
  return (
    <div className="bake-card group" onClick={onClick}>
      <img src={bake.image_url} alt={bake.title} loading="lazy" />
      <div className="overlay">
        <div className="title">{bake.title}</div>
        <div className="category">{label}</div>
      </div>
      {bake.featured && (
        <div className="featured-badge">
          <Star size={13} fill="currentColor" className="text-[#C17F59]" />
        </div>
      )}
    </div>
  );
}
