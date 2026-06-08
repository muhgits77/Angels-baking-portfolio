/**
 * Vercel Blob "Database" API — Manifest for Angel's Bakes
 * 
 * Since we only have Vercel Blob (no separate database), we treat a single
 * JSON file stored in Blob as our source of truth for all metadata:
 *   - title, category, display_order, featured, created_at
 *   - image_url (public blob URL)
 *   - pathname (for deletion)
 * 
 * This file (manifest/bakes.json) is stored with public access so the
 * frontend gallery can load it directly if desired, but we always go
 * through this API for consistency and to allow future enhancements.
 * 
 * Endpoints:
 *   GET  /api/bakes          → returns current Bake[]
 *   POST /api/bakes          → body: { bakes: Bake[], deletePathnames?: string[] }
 *                              Saves the new manifest + optionally deletes images.
 * 
 * All write operations require VERCEL_BLOB_READ_WRITE_TOKEN on the server.
 * No client ever sees the token.
 */

import { list, put, del } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface Bake {
  id: string;
  title: string;
  category: string;
  image_url: string;
  pathname: string;
  display_order: number;
  featured: boolean;
  created_at: string;
}

const MANIFEST_PATH = 'manifest/bakes.json';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const bakes = await getBakesFromBlob();
      return res.status(200).json(bakes);
    }

    if (req.method === 'POST') {
      const { bakes, deletePathnames } = req.body as {
        bakes: Bake[];
        deletePathnames?: string[];
      };

      if (!Array.isArray(bakes)) {
        return res.status(400).json({ error: 'bakes must be an array' });
      }

      // 1. Delete any blobs that are being removed (images)
      if (deletePathnames && deletePathnames.length > 0) {
        await del(deletePathnames).catch((err) => {
          console.warn('Some blob deletions failed (non-fatal):', err);
        });
      }

      // 2. Save the new manifest (this is our "database write")
      await saveManifest(bakes);

      return res.status(200).json({ success: true, count: bakes.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Bakes API error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}

/**
 * Reads the current manifest from Vercel Blob.
 * Uses list() to find the file (works even if we don't know the exact store subdomain),
 * then fetches the public JSON URL.
 */
async function getBakesFromBlob(): Promise<Bake[]> {
  if (!process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
    // In local dev without token this will be empty — that's okay for viewing the site.
    console.warn('VERCEL_BLOB_READ_WRITE_TOKEN not set — returning empty bakes list');
    return [];
  }

  try {
    const { blobs } = await list({
      prefix: MANIFEST_PATH,
      limit: 1,
    });

    if (blobs.length === 0) {
      return []; // First time — no photos yet
    }

    const manifestUrl = blobs[0].url;
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to read manifest from Blob:', err);
    return [];
  }
}

/**
 * Writes the full list of bakes as a public JSON file.
 * Using addRandomSuffix: false ensures we always overwrite the same logical file.
 */
async function saveManifest(bakes: Bake[]): Promise<void> {
  if (!process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
    throw new Error('VERCEL_BLOB_READ_WRITE_TOKEN is required for writes');
  }

  const json = JSON.stringify(bakes, null, 2);

  await put(MANIFEST_PATH, json, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 60, // Short cache so updates are visible reasonably fast
  });
}
