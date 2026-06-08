import { Link, useLocation } from 'react-router-dom';
import { Camera, Menu, X, Printer } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface NavProps {
  onOpenStudio: () => void;
  onPrint: () => void;
}

export function Nav({ onOpenStudio, onPrint }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: '/', label: 'Home' },
    { to: '/story', label: 'My Story' },
    { to: '/signature', label: 'Signature' },
    { to: '/gallery', label: 'Gallery' },
    { to: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-full bg-[#C17F59] flex items-center justify-center text-white text-xl shadow-inner group-active:scale-95 transition">
            🥐
          </div>
          <div>
            <div className="font-semibold tracking-[-0.5px] text-[21px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Angel's Baking
            </div>
          </div>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <div className="nav-links">
            {links.map(l => (
              <Link key={l.to} to={l.to} className={isActive(l.to) ? 'active' : ''}>{l.label}</Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="btn btn-ghost flex items-center gap-1.5 text-sm" title="Print / Export PDF">
              <Printer size={15} /> Print
            </button>
            <ThemeToggle />
            <button onClick={onOpenStudio} className="btn btn-primary text-sm px-5 py-2 flex items-center gap-2">
              <Camera size={16} /> Studio
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-1.5">
          <button onClick={onPrint} className="btn btn-ghost p-2" aria-label="Print portfolio">
            <Printer size={18} />
          </button>
          <ThemeToggle />
          <button onClick={onOpenStudio} className="btn btn-primary text-sm px-3.5 py-1.5 flex items-center gap-1.5">
            <Camera size={15} /> Studio
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2.5 text-[#6B5344]">
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)] px-5 py-4 text-sm">
          <div className="flex flex-col gap-1">
            {links.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)} className={`py-2.5 ${isActive(l.to) ? 'text-[var(--accent)] font-medium' : ''}`}>
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-[var(--border)] my-1" />
            <button onClick={() => { onOpenStudio(); setMobileOpen(false); }} className="py-2.5 text-left flex items-center gap-2 text-[var(--accent)]">
              <Camera size={16} /> Open Studio
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
