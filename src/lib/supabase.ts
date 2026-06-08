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
