import { API_BASE_URL } from './api';

/**
 * Resolve a file URL for display/download.
 * Handles both local paths (/uploads/...) and absolute Cloudinary URLs.
 */
export function resolveFileUrl(url: string): string {
  if (!url) return '';
  // Already an absolute URL (Cloudinary, etc.) — use as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Local path — prepend the API root
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

  const proxyUrl = `${API_BASE_URL}/upload/download?url=${encodeURIComponent(absoluteUrl)}&filename=${encodeURIComponent(fileName)}`;

  onStart?.();

  const token = localStorage.getItem('accessToken');
  fetch(proxyUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((r) => {
      if (!r.ok) throw new Error('Download failed');
      return r.blob();
    })
    .then((blob) => {
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
