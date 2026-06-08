/**
 * Vercel Blob Upload API Route
 * 
 * Handles secure image uploads for Angel's Studio.
 * - Uses VERCEL_BLOB_READ_WRITE_TOKEN on the server only (never exposed to client).
 * - Accepts multipart/form-data with a "file" field.
 * - Stores images under the "bakes/" prefix with a timestamped name for uniqueness.
 * - Returns the public URL and pathname (pathname is needed for later deletion).
 * 
 * Client calls this first during "Publish to Gallery", then updates the manifest.
 */

import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // The token must be set in Vercel Environment Variables (no VITE_ prefix).
    if (!process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'VERCEL_BLOB_READ_WRITE_TOKEN not configured on server' });
    }

    // In Vercel serverless (especially with form data), the body may already be parsed
    // or we receive it as a raw buffer. The most reliable cross-runtime way is to
    // reconstruct FormData from the raw request.
    const formData = await getFormDataFromRequest(req);

    const file = formData.get('file') as File | null;

    if (!file) {
      return res.status(400).json({ error: 'No file provided (expected form field "file")' });
    }

    if (!file.type.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    // Unique pathname
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const pathname = `bakes/${timestamp}-${safeName}`;

    // Public upload — the returned URL can be used directly in <img src>
    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });

    return res.status(200).json({
      url: blob.url,       // Use this as Bake.image_url
      pathname: blob.pathname, // Store this so we can delete the blob later
    });
  } catch (error: any) {
    console.error('Vercel Blob upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

/**
 * Robust FormData extractor for Vercel serverless functions.
 */
async function getFormDataFromRequest(req: VercelRequest): Promise<FormData> {
  // If the platform already gave us formData (some runtimes), use it.
  // Otherwise fall back to manual reconstruction.
  // @ts-ignore - runtime specific
  if (typeof req.formData === 'function') {
    // @ts-ignore
    return await req.formData();
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || 'multipart/form-data';
  const response = new Response(buffer, { headers: { 'content-type': contentType } });
  return await response.formData();
}
