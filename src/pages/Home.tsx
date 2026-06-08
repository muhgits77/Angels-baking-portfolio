import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBakes } from '../hooks/useBakes';
import { useSiteContent } from '../hooks/useSiteContent';
import { useTestimonials } from '../hooks/useTestimonials';
import { BakeCard } from '../components/BakeCard';
import type { Bake } from '../lib/supabase';

/**
 * GOAT Home: Cinematic, personal, emotional entry point.
 * Uses Angel's real featured bakes in the hero when available.
 * Subtle motion + scroll reveals for premium feel.
 */

interface HomeProps {
  onOpenStudio: () => void;
  onOpenInquiry: (bakeTitle?: string) => void;
  onOpenLightbox: (bake: Bake) => void;
}

// GOAT upgrade: Prefer Angel's own beautiful bakes for the cinematic hero layers
// when she has featured items. This makes the site deeply personal and mouth-watering.
const CURATED_HERO = [
  'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1600&q=80',
  'https://images.unsplash.com/photo-1555507036-ab1f40388a8b?w=1600&q=80',
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1600&q=80',
];

export function Home({ onOpenStudio, onOpenInquiry, onOpenLightbox }: HomeProps) {
  const { bakes, loading } = useBakes();
  const { content } = useSiteContent();
  const { testimonials } = useTestimonials();

  const signature = bakes.filter(b => b.featured).slice(0, 6);
  const recent = [...bakes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);

  // Use real featured bakes for hero when possible — much more authentic & premium
  const heroImages = signature.length >= 3 
    ? signature.slice(0, 3).map(b => b.image_url) 
    : CURATED_HERO;

  const tagline = content.hero_tagline || "Handcrafted with love, baked with joy";

  return (
    <div>
      {/* CINEMATIC HERO */}
      <section className="hero">
        {/* GOAT cinematic hero: real bakes when possible + subtle parallax motion */}
        <div className="hero-visuals">
          {heroImages.map((url, i) => (
            <motion.div
              key={i}
              className="bake-layer"
              style={{
                width: i === 0 ? '62%' : i === 1 ? '31%' : '27%',
                height: i === 0 ? '78%' : i === 1 ? '42%' : '38%',
                left: i === 0 ? '19%' : i === 1 ? '68%' : '6%',
                top: i === 0 ? '11%' : i === 1 ? '46%' : '53%',
                zIndex: 3 - i,
                opacity: 0.9 - i * 0.08,
              }}
              animate={{
                y: [0, i === 1 ? -14 : 9, 0],
                x: [0, i === 0 ? 6 : -4, 0],
              }}
              transition={{ duration: 18 + i * 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img src={url} alt="" />
            </motion.div>
          ))}
        </div>

        <div className="hero-inner">
          <div className="hero-badge">EST. WITH LOVE • SMALL BATCHES</div>
          <h1 className="mb-3">Angel's Baking</h1>
          <p className="tagline">{tagline}</p>

          <div className="flex flex-col sm:flex-row gap-3.5 justify-center mt-3">
            <Link to="/gallery" className="btn btn-primary btn-lg">Explore the Gallery</Link>
            <Link to="/story" className="btn btn-secondary btn-lg">Read My Story</Link>
            <button onClick={onOpenStudio} className="btn btn-secondary btn-lg flex items-center gap-2">
              Enter the Studio
            </button>
          </div>
          <div className="mt-10 text-[10px] tracking-[3px] text-[#8B6F5C]">SCROLL TO BEGIN YOUR JOURNEY</div>
        </div>

        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 text-xs text-[#8B6F5C] flex flex-col items-center">
          <div className="h-px w-5 bg-[#C9B39E] mb-1" /> ↓
        </div>
      </section>

      {/* IN THE KITCHEN — high-quality static cinematic hero
           Hands kneading dough, warm lighting, flour in the air.
           Reliable static image (replaces video for instant excellent display on all devices).
      */}
      <motion.section 
        className="kitchen-section"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="container">
          <div className="text-center mb-5">
            <div className="uppercase tracking-[3px] text-xs text-[#C17F59] mb-1">Behind the Apron</div>
            <h2 className="text-3xl tracking-tight">In the Kitchen</h2>
          </div>
          <div className="kitchen-frame">
            <img
              src="/images/kitchen-hero.jpg"
              alt="First-person view of hands kneading dough on a flour-dusted wooden bread board. Warm natural lighting, flour in the air, intimate artisan kitchen atmosphere."
              className="w-full h-auto"
            />
          </div>
          <p className="kitchen-caption">The quiet rhythm of hands, flour, and wood. This is where the magic begins.</p>
        </div>
      </motion.section>

      {/* SIGNATURE TEASER — scroll reveal for delight */}
      <motion.section 
        className="section container"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-end justify-between mb-7">
          <div>
            <div className="uppercase tracking-[3.2px] text-xs text-[#C17F59]">Favorites</div>
            <h2>Signature Bakes</h2>
          </div>
          <Link to="/signature" className="hidden sm:block text-sm text-[#C17F59] hover:underline">See all signature →</Link>
        </div>

        {signature.length > 0 ? (
          <div className="signature-grid">
            {signature.map(bake => (
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
          <div className="bg-white border border-[#E5D9C7] rounded-3xl p-10 text-center">
            <p className="text-[#6B5344]">Signature bakes will appear here once you mark some as featured in the Studio.</p>
            <button onClick={onOpenStudio} className="mt-5 btn btn-primary">Open Studio</button>
          </div>
        )}
        <div className="text-center mt-7">
          <Link to="/signature" className="btn btn-ghost">View the full Signature collection →</Link>
        </div>
      </motion.section>

      {/* GALLERY TEASER + TESTIMONIALS — warm & human */}
      <motion.section 
        className="section bg-[#F1E9DC]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}
      >
        <div className="container">
          <div className="flex items-end justify-between mb-7">
            <div>
              <div className="uppercase tracking-[3px] text-xs text-[#C17F59]">Fresh from the oven</div>
              <h2>The Gallery</h2>
            </div>
            <Link to="/gallery" className="text-sm text-[#C17F59] hover:underline hidden sm:block">Full gallery →</Link>
          </div>

          {loading && recent.length === 0 ? (
            <div className="masonry"><div className="masonry-item"><div className="bake-card h-72 skeleton" /></div></div>
          ) : (
            <div className="masonry">
              {recent.slice(0, 6).map(bake => (
                <div key={bake.id} className="masonry-item">
                  <BakeCard bake={bake} onClick={() => onOpenLightbox(bake)} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-10">
            <div className="uppercase tracking-[3px] text-xs text-[#C17F59] mb-4 text-center">Loved by many</div>
            <div className="grid md:grid-cols-3 gap-5">
              {(testimonials.length ? testimonials : [
                { id: 'd1', quote: "The sourdough is the best I've had outside of Paris. Crust is perfect, crumb is airy and full of flavor.", name: "Elena M.", role: "Weekly customer", display_order: 0, created_at: '' },
                { id: 'd2', quote: "Angel's cinnamon rolls are legendary in our house. We order them for every special occasion.", name: "The Rivera Family", role: "Neighbors", display_order: 1, created_at: '' },
                { id: 'd3', quote: "I brought her almond croissants to a brunch and three people asked for the baker's contact. Incredible.", name: "Marcus T.", role: "Regular at the market", display_order: 2, created_at: '' },
              ]).slice(0, 3).map((t: any, idx: number) => (
                <div key={t.id || idx} className="testimonial">
                  <div className="testimonial-quote">“{t.quote}”</div>
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-[#8B6F5C]">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* FINAL CTA */}
      <section className="section container text-center">
        <div className="max-w-md mx-auto">
          <h2 className="mb-3">Let’s bake something together.</h2>
          <p className="text-[#6B5344] mb-7">Custom cakes, weekly bread boxes, or just a beautiful pastry for someone you love.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="btn btn-primary btn-lg">Start an Inquiry</Link>
            <Link to="/gallery" className="btn btn-secondary btn-lg">Browse Everything</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
