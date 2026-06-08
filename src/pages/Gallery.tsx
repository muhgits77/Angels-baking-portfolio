import { useState, useMemo } from 'react';
import { useBakes } from '../hooks/useBakes';
import { BakeCard } from '../components/BakeCard';
import type { Bake } from '../lib/supabase';
import { CATEGORIES, CATEGORY_LABELS } from '../lib/supabase';
import { Camera } from 'lucide-react';

interface GalleryProps {
  onOpenLightbox: (b: Bake) => void;
  onOpenStudio: () => void;
}

export function Gallery({ onOpenLightbox, onOpenStudio }: GalleryProps) {
  const { bakes, loading, error, refetch } = useBakes();
  const [filter, setFilter] = useState<'all' | (typeof CATEGORIES)[number]>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = filter === 'all' ? bakes : bakes.filter(b => b.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [bakes, filter, search]);

  return (
    <div className="pt-11 pb-16">
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <div className="uppercase tracking-[3px] text-xs text-[#C17F59]">Every batch tells a story</div>
            <h1>The Gallery</h1>
          </div>
          <button onClick={onOpenStudio} className="btn btn-primary self-start sm:self-auto flex items-center gap-2">
            <Camera size={17} /> Add New Photo
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 flex-1">
            {(['all', ...CATEGORIES] as const).map(cat => (
              <button key={cat} onClick={() => setFilter(cat as any)} className={`chip ${filter === cat ? 'chip-active' : ''}`}>
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bakes..."
            className="input max-w-[260px] text-sm py-2"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mb-4">
            {error} <button onClick={refetch} className="underline ml-1">Retry</button>
          </div>
        )}

        {loading && bakes.length === 0 ? (
          <div className="masonry pt-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="masonry-item"><div className="bake-card"><div className="aspect-[4/3] skeleton" /></div></div>)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="masonry pt-1">
            {filtered.map(bake => (
              <div key={bake.id} className="masonry-item">
                <BakeCard bake={bake} onClick={() => onOpenLightbox(bake)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-[#E5D9C7] rounded-3xl bg-white mt-1">
            <Camera className="mx-auto text-[#C17F59] mb-4" size={38} />
            <p className="text-[#6B5344]">No bakes match your search or filter yet.</p>
            <button onClick={onOpenStudio} className="mt-4 btn btn-primary">Upload your first bake</button>
          </div>
        )}
      </div>
    </div>
  );
}
