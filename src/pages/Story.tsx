import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSiteContent } from '../hooks/useSiteContent';

/**
 * GOAT My Story page — rich, emotional, book-like long-form experience.
 * Angel edits everything live from the Studio (site_content table).
 * Beautiful typography, generous space, pull-quotes, and chapter feel.
 */
export function Story() {
  const { content, loading } = useSiteContent();

  const sections = [
    { key: 'the_beginning', title: 'The Beginning' },
    { key: 'philosophy', title: 'My Baking Philosophy' },
    { key: 'the_promise', title: 'The Promise I Make' },
  ];

  return (
    <div className="pt-14 pb-20">
      {/* Elegant, warm story header */}
      <div className="story-hero">
        <div className="container">
          <div className="uppercase tracking-[4.5px] text-xs text-[#C17F59] mb-2">A Life in the Kitchen</div>
          <h1 className="mb-3">My Story</h1>
          <p className="lead max-w-md mx-auto">{content.about_intro || "Hi, I'm Angel. I bake because it brings people together."}</p>
        </div>
      </div>

      <div className="container story-container pt-8">
        <div className="story-prose">
          {loading ? (
            <div className="space-y-4 max-w-[68ch]">
              <div className="h-5 skeleton rounded" />
              <div className="h-5 skeleton rounded w-11/12" />
              <div className="h-5 skeleton rounded w-4/5" />
            </div>
          ) : (
            <>
              {sections.map((s, idx) => {
                const text = content[s.key] || '';
                if (!text) return null;
                return (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.03 }}
                  >
                    <h3>{s.title}</h3>
                    {text.split('\n\n').map((para, pidx) => (
                      <p key={pidx}>{para}</p>
                    ))}
                    {idx < sections.length - 1 && <div className="chapter-rule" />}
                  </motion.div>
                );
              })}

              {/* Beautiful pull quote */}
              {content.philosophy && (
                <div className="story-pullquote">
                  “{content.philosophy.split('.')[0]}.”
                </div>
              )}

              <div className="pt-6">
                <p>Everything is baked fresh in small batches. No shortcuts — just real ingredients, time, and care.</p>
              </div>
            </>
          )}
        </div>

        <div className="story-meta">
          Want to read this as a beautiful printed keepsake?{' '}
          <button onClick={() => window.print()} className="underline text-[#C17F59]">Print the full portfolio</button>.
          <div className="mt-6">
            <Link to="/contact" className="btn btn-primary">Inquire about a custom bake →</Link>
          </div>
        </div>

        <div className="text-center mt-16 text-xs text-[#8B6F5C]">
          This story lives in the Studio — Angel can update every word without touching code.
        </div>
      </div>
    </div>
  );
}
