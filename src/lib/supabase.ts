/**
 * Angel's Baking Portfolio — Supabase Client (Robust, Debuggable, Browser-Only, SSR-Safe)
 *
 * HARDENED VERSION for reliable deployment and phone use:
 *
 * - Extremely debuggable: Logs env var presence (safely, no secrets), client creation, realtime readiness, and errors to console.
 * - Strict browser-only initialization: Throws immediately with deployment-friendly messages if called during SSR
 *   or if env vars are missing. This prevents silent failures on Vercel / TanStack Start / any SSR setup.
 * - Lazy singleton: Client created only once on first real use from the browser.
 * - Realtime options tuned for stability (eventsPerSecond, etc.).
 * - No localStorage for app data. (Supabase internal auth storage is disabled since we don't use user auth.)
 * - Clear, actionable error messages that mention Vercel Environment Variables and Supabase dashboard.
 *
 * Usage (always wrap in try/catch or rely on isSupabaseConfigured + hooks):
 *   const supabase = getSupabase();
 *   const { data } = await supabase.from(BAKES_TABLE)...
 *
 * On Vercel: Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STUDIO_PASSWORD in Project Settings → Environment Variables.
 * Locally: Use .env (never commit real keys).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Bake {
  id: string;
  title: string;
  category: string;
  image_url: string;
  storage_path: string | null;
  display_order: number;
  featured: boolean;
  description?: string | null;   // NEW: optional rich description for signature items & lightbox
  created_at: string;
}

// Editable site content — simple key/value for story sections, taglines, etc.
// Stored in Supabase so Angel can update everything from Studio without code changes.
export interface SiteContent {
  key: string;
  value: string;
  updated_at?: string;
}

// Testimonials — warm, authentic quotes managed entirely in Studio
export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  display_order: number;
  created_at: string;
}

// Custom order inquiries submitted from the Contact page or "Request this bake" CTAs.
// Angel reviews them directly inside the Studio.
export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  inquiry_type: string;           // e.g. "Custom Cake", "Weekly Bread Box", "Special Occasion", "Order Specific Bake"
  message: string;
  bake_title?: string | null;     // When coming from a specific signature item
  handled: boolean;
  created_at: string;
}

// Studio password (client-side gate only — never log the actual value)
export const STUDIO_PASSWORD = (import.meta.env.VITE_STUDIO_PASSWORD as string | undefined) || '';

// Fixed categories — stable for filters and Studio pills
export const CATEGORIES = [
  'breads',
  'cakes',
  'donuts',
  'bagels',
  'pastries',
  'cookies',
  'muffins',
  'pies',
  'dips',
  'jams',
  'compotes',
  'gifts',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category | 'all', string> = {
  all: 'All',
  breads: 'Breads',
  cakes: 'Cakes',
  donuts: 'Donuts',
  bagels: 'Bagels',
  pastries: 'Pastries',
  cookies: 'Cookies',
  muffins: 'Muffins',
  pies: 'Pies',
  dips: 'Dips',
  jams: 'Jams',
  compotes: 'Compotes',
  gifts: 'Gifts',
};

// Read env vars once at module load (for early logging)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabaseInstance: SupabaseClient | null = null;
let hasLoggedEnvStatus = false;

/**
 * Logs safe debug info about env configuration (called on first getSupabase).
 * Never logs the actual key or full URL.
 */
function logEnvStatus() {
  if (hasLoggedEnvStatus) return;
  hasLoggedEnvStatus = true;

  const urlPresent = !!SUPABASE_URL;
  const keyPresent = !!SUPABASE_ANON_KEY;
  const passwordPresent = !!STUDIO_PASSWORD;

  console.log(
    '[Supabase] Env status (safe):',
    {
      VITE_SUPABASE_URL_present: urlPresent,
      VITE_SUPABASE_ANON_KEY_present: keyPresent,
      VITE_STUDIO_PASSWORD_present: passwordPresent,
      projectHint: SUPABASE_URL ? SUPABASE_URL.replace(/https?:\/\/([^.]+).*/, '$1') : 'missing',
    }
  );

  if (!urlPresent || !keyPresent) {
    console.error(
      '[Supabase] CRITICAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
      '→ On Vercel: Project Settings → Environment Variables (must be VITE_ prefixed).\n' +
      '→ Locally: Create .env with the values and restart dev server.\n' +
      '→ After changing Vercel vars you must redeploy (or use Preview Deployment).'
    );
  }
}

/**
 * Returns the Supabase client (browser only, lazy, singleton).
 * 
 * ROBUSTNESS:
 * - Immediate SSR guard with clear error.
 * - Detailed logging of creation success/failure.
 * - Actionable error messages mentioning Vercel env vars.
 */
export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    const msg =
      'getSupabase() was called on the server (SSR). ' +
      'Supabase client must only be used in the browser. ' +
      'This is expected during build/SSR — the guard protects you.';
    console.error('[Supabase]', msg);
    throw new Error(msg);
  }

  logEnvStatus();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const msg =
      'Missing Supabase config. ' +
      'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Environment Variables ' +
      '(or your local .env file). ' +
      'After updating Vercel vars, redeploy the project.';
    console.error('[Supabase] ERROR:', msg);
    throw new Error(msg);
  }

  if (!supabaseInstance) {
    try {
      console.log('[Supabase] Creating client for project:', SUPABASE_URL.replace(/https?:\/\/([^.]+).*/, '$1...'));

      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // We don't use Supabase Auth users — keep this minimal and non-persistent.
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 4,
          },
        },
        // Global fetch with some resilience (timeout not directly supported, but we can note it)
        global: {
          // You can add headers or fetch overrides here if needed for debugging
        },
      });

      console.log('[Supabase] Client created successfully. Realtime enabled.');
    } catch (err: any) {
      console.error('[Supabase] Failed to create client:', err);
      throw new Error(
        `Failed to initialize Supabase client: ${err.message}. ` +
        'Verify your anon key is correct and the project is reachable.'
      );
    }
  }

  return supabaseInstance;
}

/**
 * Safe check used before opening Studio or performing actions.
 * Returns false + logs guidance if misconfigured.
 */
export function isSupabaseConfigured(): boolean {
  const ok = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  if (!ok) {
    console.warn(
      '[Supabase] Not configured. Studio and data features will be disabled. ' +
      'Fix: Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in Vercel (or .env) and redeploy/restart.'
    );
  }
  return ok;
}

/**
 * Project constants (used by hooks and components).
 */
export const SUPABASE_PROJECT_URL = 'https://nikppnqnwtwgwzfktzuu.supabase.co';
export const BAKES_TABLE = 'bakes';
export const BAKES_BUCKET = 'bakes';

// New lightweight tables for full content control (Angel edits everything in Studio).
// These are additive — existing bakes table, policies, and realtime remain 100% untouched.
export const SITE_CONTENT_TABLE = 'site_content';
export const TESTIMONIALS_TABLE = 'testimonials';
export const INQUIRIES_TABLE = 'inquiries';

// Default / fallback content for first run (beautifully written, Angel can instantly replace in Studio)
export const DEFAULT_STORY: Record<string, string> = {
  hero_tagline: "Handcrafted with love, baked with joy",
  about_intro: "Hi, I'm Angel. I bake because it brings people together. Every loaf, cake, and pastry is made by hand with the best ingredients I can find — butter, flour, seasonal fruit, and a whole lot of care.",
  the_beginning: "I grew up in a tiny kitchen where the smell of cinnamon and rising dough meant home. My grandmother taught me that baking is equal parts precision and generosity. Those early mornings sifting flour and learning to listen to the oven shaped everything I do today.",
  philosophy: "I believe the best things take time. Slow fermentation, real butter, fruit at its peak. Nothing rushed, nothing artificial. When you take a bite, I want you to taste patience, craft, and the simple happiness of something made just for you.",
  the_promise: "Small batches only. Everything leaves my kitchen the same day it's baked. No shortcuts — just honest ingredients, time-honored technique, and the quiet joy of feeding the people I love.",
};

export const DEFAULT_TESTIMONIALS = [
  { quote: "The sourdough is the best I've had outside of Paris. Crust is perfect, crumb is airy and full of flavor.", name: "Elena M.", role: "Weekly customer" },
  { quote: "Angel's cinnamon rolls are legendary in our house. We order them for every special occasion.", name: "The Rivera Family", role: "Neighbors" },
  { quote: "I brought her almond croissants to a brunch and three people asked for the baker's contact. Incredible.", name: "Marcus T.", role: "Regular at the market" },
];

/**
 * Optional helper you can call from console in dev for quick status.
 */
export function debugSupabase() {
  console.log('[Supabase Debug]', {
    urlPresent: !!SUPABASE_URL,
    keyPresent: !!SUPABASE_ANON_KEY,
    passwordPresent: !!STUDIO_PASSWORD,
    clientCreated: !!supabaseInstance,
  });
  return { url: SUPABASE_URL, hasClient: !!supabaseInstance };
}

/**
 * Safe fetch for a single piece of site content (returns default if missing).
 * Used by public pages. Studio writes directly.
 */
export async function fetchSiteContent(): Promise<Record<string, string>> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(SITE_CONTENT_TABLE)
      .select('key, value');

    if (error) {
      console.error('[fetchSiteContent] Select error (RLS or table missing?):', {
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      });
      throw error;
    }
    
    const result: Record<string, string> = { ...DEFAULT_STORY };
    (data || []).forEach((row: any) => {
      if (row.key && row.value != null) result[row.key] = row.value;
    });
    console.log('[fetchSiteContent] Loaded', Object.keys(result).length, 'keys (including defaults)');
    return result;
  } catch (e: any) {
    console.warn('[Supabase] site_content fetch failed, using defaults. Full error:', e?.message || e);
    return { ...DEFAULT_STORY };
  }
}

/**
 * Upsert a content key (simple & reliable).
 * 
 * FIXED: Added detailed error logging + fallback to explicit insert-then-update pattern
 * for cases where upsert onConflict behaves oddly with RLS or PostgREST.
 * This makes "My Story" saves much more robust.
 */
export async function saveSiteContent(key: string, value: string) {
  const supabase = getSupabase();
  try {
    // Preferred: upsert (handles insert or update based on PK "key")
    const { error } = await supabase
      .from(SITE_CONTENT_TABLE)
      .upsert({ key, value }, { onConflict: 'key' });

    if (error) {
      console.error('[saveSiteContent] Upsert failed, trying fallback insert+update:', error);
      // Fallback: try update first
      const { data: updateData, error: updateErr } = await supabase
        .from(SITE_CONTENT_TABLE)
        .update({ value })
        .eq('key', key)
        .select();

      if (updateErr) throw updateErr;

      if (!updateData || updateData.length === 0) {
        // No row existed — insert
        const { error: insertErr } = await supabase
          .from(SITE_CONTENT_TABLE)
          .insert({ key, value });
        if (insertErr) throw insertErr;
      }
    }
    console.log('[saveSiteContent] Successfully saved key:', key);
  } catch (err: any) {
    console.error('[saveSiteContent] FINAL FAILURE for key', key, {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      full: err,
    });
    throw err;
  }
}
