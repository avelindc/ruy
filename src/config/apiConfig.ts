/** Single API URL for the new Breakout Music Worker. */
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();

export function getApiBaseUrl(): string {
  if (configuredApiUrl) {
    const url = new URL(configuredApiUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      throw new Error('VITE_API_URL must use HTTPS outside local development.');
    }
    return url.toString().replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) return 'http://localhost:8787';
  throw new Error('VITE_API_URL must point to the new Breakout Music Worker.');
}

export function getStorageApiUrl(fileKey: string): string {
  return `${getApiBaseUrl()}/api/storage/${encodeURIComponent(fileKey.replace(/^\/+/, ''))}`;
}

export default { getApiBaseUrl, getStorageApiUrl };
