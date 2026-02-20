import { API_BASE_URL } from '@/lib/api';

// Derive the origin that serves /uploads.
// In production API_BASE_URL is "/api/v1" (relative), so origin = "" (same host).
// In development API_BASE_URL is "http://localhost:3001/api/v1", so origin = "http://localhost:3001".
let apiOrigin = '';
try {
  const parsedUrl = new URL(API_BASE_URL);
  apiOrigin = parsedUrl.origin;

  // If the API origin is localhost but we're not on localhost, use current origin
  // This handles the case where VITE_API_URL wasn't set during production build
  if (typeof window !== 'undefined' &&
    (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1') {
    apiOrigin = window.location.origin;
  }
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

/**
 * Convert external video sharing URLs into direct-playable URLs.
 * Supports Google Drive, Dropbox, and OneDrive sharing links.
 * Falls through to the original URL if no transformation is needed.
 */
export const toDirectVideoUrl = (url: string): string => {
  if (!url) return url;

  // --- Cloudinary: ensure MP4 delivery for mobile compatibility ---
  // Cloudinary can transcode on the fly by changing the file extension.
  // e.g. .../videos/foo.avi  ->  .../videos/foo.mp4
  // e.g. .../videos/foo.mkv  ->  .../videos/foo.mp4
  if (/res\.cloudinary\.com/i.test(url) && /\/video\/upload\//i.test(url)) {
    // Only transform if not already .mp4
    if (!url.toLowerCase().split('?')[0].endsWith('.mp4')) {
      url = url.replace(/\.[^/.?]+(\?|$)/, '.mp4$1');
    }
  }

  // --- Google Drive ---
  // Pattern: https://drive.google.com/file/d/FILE_ID/view?...
  //       -> https://drive.google.com/uc?export=download&id=FILE_ID
  // Also handles /preview variant
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (gdMatch) {
    return `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
  }

  // Pattern: https://drive.google.com/open?id=FILE_ID
  const gdOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (gdOpenMatch) {
    return `https://drive.google.com/uc?export=download&id=${gdOpenMatch[1]}`;
  }

  // --- Dropbox ---
  // Pattern: https://www.dropbox.com/...?dl=0
  //       -> https://www.dropbox.com/...?dl=1   (or ?raw=1)
  if (/dropbox\.com/i.test(url)) {
    const u = new URL(url);
    u.searchParams.set('dl', '1');
    return u.toString();
  }

  // --- OneDrive / SharePoint ---
  // Pattern: https://onedrive.live.com/...?e=...
  //       -> https://onedrive.live.com/...?download=1
  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i.test(url)) {
    const u = new URL(url);
    u.searchParams.set('download', '1');
    return u.toString();
  }

  // No transformation needed
  return url;
};
