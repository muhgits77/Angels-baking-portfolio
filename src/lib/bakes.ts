/**
 * Angel's Baking Portfolio — Shared Types & Constants (Vercel Blob version)
 *
 * This replaces the old Supabase-centric module.
 * - Bake interface now uses `pathname` (for Vercel Blob deletion) instead of storage_path.
 * - CATEGORIES and labels are the single source of truth.
 * - STUDIO_PASSWORD is read from VITE_STUDIO_PASSWORD (client-safe).
 * - No Supabase, no realtime, no client-side secrets for storage.
 */

export interface Bake {
  id: string;
  title: string;
  category: string;
  image_url: string;   // Public Vercel Blob URL (https://...public.vercel-storage.com/...)
  pathname: string;    // The blob pathname, required to delete the image later
  display_order: number;
  featured: boolean;
  created_at: string;
}

/**
 * Studio password (client only — used for the simple password gate).
 * Set via VITE_STUDIO_PASSWORD in your environment.
 */
export const STUDIO_PASSWORD = (import.meta.env.VITE_STUDIO_PASSWORD as string | undefined) || '';

/**
 * Fixed list of categories. Keep this stable.
 */
export const CATEGORIES = [
  'breads',
  'cakes',
  'donuts',
  'bagels',
  'pastries',
  'cookies',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Human readable labels for filters and pills.
 */
export const CATEGORY_LABELS: Record<Category | 'all', string> = {
  all: 'All',
  breads: 'Breads',
  cakes: 'Cakes',
  donuts: 'Donuts',
  bagels: 'Bagels',
  pastries: 'Pastries',
  cookies: 'Cookies',
};
