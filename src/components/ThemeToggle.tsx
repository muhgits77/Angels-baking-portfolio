import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('angels-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = saved ? saved === 'warm-dark' : prefersDark;
    
    setIsDark(shouldDark);
    document.documentElement.classList.toggle('warm-dark', shouldDark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('warm-dark', next);
    localStorage.setItem('angels-theme', next ? 'warm-dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="theme-toggle"
      aria-label={isDark ? 'Switch to warm light mode' : 'Switch to golden hour mode'}
      title={isDark ? 'Warm light' : 'Golden hour'}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
