import { API_BASE_URL } from '@/lib/api';

// Derive the origin that serves /uploads.
// In production API_BASE_URL is "/api/v1" (relative), so origin = "" (same host).
// In development API_BASE_URL is "http://localhost:3001/api/v1", so origin = "http://localhost:3001".
let apiOrigin = '';
try {
  apiOrigin = new URL(API_BASE_URL).origin;
} catch {
  // relative URL – uploads are served from the same origin
  apiOrigin = '';
}

/**
 * Resolve a media URL stored in the API to an absolute URL the frontend can use.
 * Handles several edge cases from instructor dashboard uploads:
 * - full URLs (http/https)
 * - data URLs (base64)
 * - backslashes (Windows paths)
 * - URLs that contain '/uploads/' in unexpected places (e.g., '/api/v1/uploads/...')
 */
export const resolveMediaUrl = (url?: string | null) => {
  if (!url) return '';

  let value = url.trim();

  // Return data URLs unchanged
  if (value.startsWith('data:')) return value;

  // Normalize backslashes to forward slashes (Windows uploads)
  value = value.replace(/\\+/g, '/');

  // Full absolute URLs should be returned as-is
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  // If the value starts with 'uploads/' (no leading slash), just prepend origin
  if (value.startsWith('uploads/')) {
    return `${apiOrigin}/${value}`;
  }

  // If the value contains '/uploads/' somewhere (e.g. '/api/v1/uploads/..' or '/uploads/..'),
  // use the last '/uploads/' occurrence as the public path root.
  const uploadsIndex = value.lastIndexOf('/uploads/');
  if (uploadsIndex !== -1) {
    const uploadsPath = value.substring(uploadsIndex);
    return `${apiOrigin}${uploadsPath}`;
  }

  // If it already starts with /uploads, just prepend origin
  if (value.startsWith('/uploads/')) {
    return `${apiOrigin}${value}`;
  }

  // Ensure leading slash and prepend /uploads
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return `${apiOrigin}/uploads${withLeadingSlash}`;
};
