/**
 * Media URL Resolver for BREAKOUT MUSIC
 * Resolves relative storage keys or URLs into absolute retrievable URLs.
 */

import { getApiBaseUrl } from '@config/apiConfig';

export function resolveMediaUrl(url?: string | null): string {
  const API_BASE_URL = getApiBaseUrl();
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already absolute HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Relative storage path on worker backend
  if (trimmed.startsWith('/api/storage/') || trimmed.startsWith('/api/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  // Bare storage key like "covers/..." or "audio/..."
  if (trimmed.startsWith('covers/') || trimmed.startsWith('audio/')) {
    return `${API_BASE_URL}/api/storage/${encodeURIComponent(trimmed)}`;
  }

  // Local static asset (e.g. "/images/...")
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `${API_BASE_URL}/api/storage/${encodeURIComponent(trimmed)}`;
}
