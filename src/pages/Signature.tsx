import { useState } from 'react';
import { useBakes } from '../hooks/useBakes';
import { BakeCard } from '../components/BakeCard';
import type { Bake } from '../lib/supabase';
import { CATEGORY_LABELS } from '../lib/supabase';

interface SignatureProps {
  onOpenLightbox: (b: Bake) => void;
  onOpenInquiry: (title: string) => void;
}

export function Signature({ onOpenLightbox, onOpenInquiry }: SignatureProps) {
  const { bakes, loading } = useBakes();
  const [filter, setFilter] = useState<'all' | string>('all');

  const signature = bakes.filter(b => b.featured);
  const filtered = filter === 'all' ? signature : signature.filter(b => b.category === filter);

  return (
    <div className="pt-12 pb-16">
      <div className="container">
        <div className="max-w-2xl mb-9">
          <div className="uppercase tracking-[3.5px] text-xs text-[#C17F59]">The Heart of the Kitchen</div>
          <h1 className="mt-1">Signature Bakes</h1>
          <p className="lead mt-3">These are the loaves, cakes, and pastries I return to again and again. Each one has a story, a rhythm, and a little bit of my heart in it.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-1 px-1 mb-3">
          {(['all', ...(['breads','cakes','pastries','cookies','donuts','bagels'] as const)] as const).map(cat => (
            <button key={cat} onClick={() => setFilter(cat as any)} className={`chip ${filter === cat ? 'chip-active' : ''}`}>
              {cat === 'all' ? 'All Signature' : (CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || String(cat))}
            </button>
          ))}
        </div>

        {loading && filtered.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[380px] skeleton rounded-3xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="signature-grid">
            {filtered.map(bake => (
              <BakeCard
                key={bake.id}
                bake={bake}
                variant="signature"
                onClick={() => onOpenLightbox(bake)}
                onRequest={() => onOpenInquiry(bake.title)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-[#E5D9C7] rounded-3xl bg-white">
            <p className="text-[#6B5344]">No signature items yet in this category. Mark some bakes as “featured” in the Studio.</p>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-[#8B6F5C]">
          Can’t find what you’re dreaming of? <a href="/contact" className="text-[#C17F59] underline">Let’s create something together.</a>
        </div>
      </div>
    </div>
  );
}
