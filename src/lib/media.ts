import { API_BASE_URL } from '@/lib/api';

const apiOrigin = new URL(API_BASE_URL).origin;

export const resolveMediaUrl = (url?: string | null) => {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (withLeadingSlash.startsWith('/uploads/')) {
    return `${apiOrigin}${withLeadingSlash}`;
  }

  return `${apiOrigin}/uploads${withLeadingSlash}`;
};
