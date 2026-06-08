/**
 * Angel's Baking Portfolio — GOAT Edition
 *
 * Multi-page premium React experience powered by the exact same Supabase backend
 * (bakes table + storage bucket + realtime + existing Studio password gate).
 *
 * New capabilities (additive, zero breaking changes):
 * - React Router pages: Home, Story, Signature, Gallery, Contact
 * - Powerful tabbed Studio (Bakes with drag-reorder, Story editor, Testimonials, Inquiries, Settings)
 * - Editable long-form story + testimonials entirely from Studio
 * - Real inquiry form that writes to Supabase (visible in Studio)
 * - Cinematic hero, drool-worthy lightbox, warm/dark theme, print/PDF export
 * - Every important text surface is editable without touching code
 *
 * Keep this file focused on orchestration + global state.
 */

import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

import { Nav } from './components/Nav';
import { Studio } from './components/Studio';
import { Lightbox } from './components/Lightbox';
import { InquiryModal } from './components/InquiryModal';

import { Home } from './pages/Home';
import { Story } from './pages/Story';
import { Signature } from './pages/Signature';
import { Gallery } from './pages/Gallery';
import { Contact } from './pages/Contact';

import { STUDIO_PASSWORD, isSupabaseConfigured, type Bake } from './lib/supabase';
import { useBakes } from './hooks/useBakes';

function AppInner() {
  const { bakes } = useBakes();
  const navigate = useNavigate();
  const location = useLocation();

  // Global UI state
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioAuthed, setStudioAuthed] = useState(false);
  const [lightboxBake, setLightboxBake] = useState<Bake | null>(null);
  const [inquiryBakeTitle, setInquiryBakeTitle] = useState<string | null>(null);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  // === Actions ===
  const openStudio = () => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (and VITE_STUDIO_PASSWORD).');
      return;
    }
    setIsStudioOpen(true);
  };
  const closeStudio = () => setIsStudioOpen(false);

  const handleStudioAuthed = () => setStudioAuthed(true);
  const exitStudio = () => {
    setStudioAuthed(false);
    setIsStudioOpen(false);
  };

  const openLightbox = (bake: Bake) => setLightboxBake(bake);
  const closeLightbox = () => setLightboxBake(null);
  const navigateLightbox = (bake: Bake) => setLightboxBake(bake);

  const openInquiry = (bakeTitle?: string) => {
    setInquiryBakeTitle(bakeTitle || null);
    setIsInquiryOpen(true);
  };
  const closeInquiry = () => {
    setIsInquiryOpen(false);
    setInquiryBakeTitle(null);
  };

  const handlePrint = () => {
    if (location.pathname !== '/') navigate('/');
    setTimeout(() => window.print(), 160);
    toast('Print dialog opening — choose "Save as PDF" for a gorgeous digital portfolio.', { duration: 4800 });
  };

  // Smooth route transitions
  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav onOpenStudio={openStudio} onPrint={handlePrint} />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <Routes>
            <Route
              path="/"
              element={<Home onOpenStudio={openStudio} onOpenInquiry={openInquiry} onOpenLightbox={openLightbox} />}
            />
            <Route path="/story" element={<Story />} />
            <Route
              path="/signature"
              element={<Signature onOpenLightbox={openLightbox} onOpenInquiry={openInquiry} />}
            />
            <Route
              path="/gallery"
              element={<Gallery onOpenLightbox={openLightbox} onOpenStudio={openStudio} />}
            />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <footer className="no-print border-t border-[var(--border)] py-8 text-center text-xs text-[var(--text-light)]">
        © {new Date().getFullYear()} Angel's Baking — Handcrafted with love.{' '}
        <button onClick={handlePrint} className="underline hover:text-[var(--accent)] active:opacity-70">Print Portfolio</button>
      </footer>

      {/* ==================== GLOBAL MODALS ==================== */}
      <AnimatePresence>
        {isStudioOpen && (
          <Studio
            isOpen={isStudioOpen}
            onClose={closeStudio}
            onExitAuth={exitStudio}
            authed={studioAuthed}
            onAuthed={handleStudioAuthed}
            password={STUDIO_PASSWORD}
          />
        )}
      </AnimatePresence>

      <Lightbox
        bake={lightboxBake}
        allBakes={bakes}
        onClose={closeLightbox}
        onNavigate={navigateLightbox}
        onRequest={(bake) => openInquiry(bake.title)}
      />

      <InquiryModal isOpen={isInquiryOpen} onClose={closeInquiry} prefillBake={inquiryBakeTitle} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
