import api, { API_BASE_URL } from './api';
import { resolveMediaUrl } from './media';

/**
 * Resolve a file URL for display/download.
 * Handles both local paths (/uploads/...) and absolute Cloudinary URLs.
 */
export function resolveFileUrl(url: string): string {
  if (!url) return '';

  // Reuse the shared media normalizer so legacy values like:
  // - "1771260062503-235614758.png"
  // - "uploads/file.pdf"
  // - "/api/v1/uploads/file.pdf"
  // all resolve correctly to a public /uploads URL.
  const resolved = resolveMediaUrl(url);
  if (resolved) return resolved;

  // Fallback safety (should rarely be hit)
  const apiRoot = API_BASE_URL.replace('/api/v1', '');
  return `${apiRoot}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Download a project file (attachment or submission) using the backend proxy.
 * This handles CORS, Cloudinary raw files, and sets Content-Disposition so the
 * browser saves the file with the correct name and extension.
 */
export function downloadProjectFile(
  fileUrl: string,
  fileName: string,
  onStart?: () => void,
  onEnd?: () => void,
) {
  // Resolve to absolute URL for the proxy
  const absoluteUrl = resolveFileUrl(fileUrl);


  onStart?.();

  api
    .get('/upload/download', {
      params: { url: absoluteUrl, filename: fileName },
      responseType: 'blob',
    })
    .then((response) => {
      const blob = response.data as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    })
    .catch(() => {
      // Fallback: open the resolved URL in a new tab
      window.open(absoluteUrl, '_blank');
    })
    .finally(() => {
      onEnd?.();
    });
}
