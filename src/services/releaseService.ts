/**
 * Breakout Music release API client.
 */

import type { Release } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from '@lib/api/client';

/**
 * Get all releases for current user
 */
export async function getUserReleases(userId: string) {
  try {
    const response = await apiGet<any>(`/api/releases?owner_id=${encodeURIComponent(userId)}&limit=100`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch releases');
    }

    return { data: response.data?.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch releases';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get releases by status
 */
export async function getReleasesByStatus(userId: string, status: string) {
  try {
    const response = await apiGet<any>(`/api/releases?owner_id=${encodeURIComponent(userId)}&limit=100`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch releases');
    }

    // Filter by status on the client (adapter doesn't support status filtering)
    const filtered = (response.data?.data || []).filter((r: Release) => r.status === status);
    return { data: filtered, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch releases';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get single release by ID
 */
export async function getReleaseById(id: string) {
  try {
    const response = await apiGet<Release>(`/api/releases/${encodeURIComponent(id)}`);

    if (!response.success) {
      if (response.code === 'NOT_FOUND') {
        return { data: null, error: null };
      }
      throw new Error(response.error || 'Failed to fetch release');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch release';
    return { data: null, error: new Error(message) };
  }
}

export interface UploadResult {
  file_key: string;
  url: string;
  filename: string;
  mime_type: string;
  size: number;
  storage: 'r2' | 'database_chunks';
  verified: boolean;
}

/** Request a five-minute bearer URL for the authenticated owner/admin to preview a master file. */
export async function getSignedPrivateMediaUrl(fileUrl: string): Promise<string> {
  const parsed = new URL(fileUrl, window.location.origin);
  const marker = '/api/storage/';
  const index = parsed.pathname.indexOf(marker);
  if (index < 0) throw new Error('Audio file URL is not managed by the Breakout Music Worker.');
  const fileKey = decodeURIComponent(parsed.pathname.slice(index + marker.length));
  const response = await apiPost<{ url: string }>('/api/storage/sign', { fileKey });
  if (!response.success || !response.data?.url) throw new Error(response.error || 'Tidak dapat membuat akses preview audio.');
  return response.data.url;
}

/**
 * Upload audio or image file to verified storage backend with progress tracking
 */
export async function uploadReleaseFile(
  file: File,
  type: 'artwork' | 'cover' | 'audio',
  onProgress?: (percent: number) => void
): Promise<{ data: UploadResult | null; error: Error | null }> {
  return new Promise(async (resolve) => {
    try {
      const { getApiBaseUrl } = await import('@config/apiConfig');
      const API_URL = getApiBaseUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/uploads`, true);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(Math.round((event.loaded / event.total) * 100), 99);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && result.success) {
            if (onProgress) onProgress(100);
            resolve({ data: result.data, error: null });
          } else {
            resolve({ data: null, error: new Error(result.error || `Upload gagal dengan status ${xhr.status}`) });
          }
        } catch (e: any) {
          resolve({ data: null, error: new Error('Gagal membaca respons server storage') });
        }
      };

      xhr.onerror = () => {
        resolve({ data: null, error: new Error('Terjadi kesalahan jaringan saat mengunggah file. Silakan periksa koneksi internet.') });
      };

      xhr.ontimeout = () => {
        resolve({ data: null, error: new Error('Waktu upload habis (timeout). Silakan coba lagi.') });
      };

      xhr.send(formData);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      resolve({ data: null, error: new Error(message) });
    }
  });
}

/**
 * Create new release
 */
export type ReleaseMutation = Partial<Release> & {
  title: string;
  release_type?: 'single' | 'ep' | 'album';
  primary_artist_id?: string;
  cover_artwork_url?: string;
  artwork_url?: string;
  genre?: string;
  language?: string;
  release_date?: string;
  release_version?: string;
  subgenre?: string;
  original_release_date?: string;
  featured_artists?: string[];
  self_released?: boolean;
  copyright_c?: string;
  copyright_p?: string;
  notes?: string;
  distribution_rights_confirmed?: boolean;
  tracks?: Array<Record<string, unknown>>;
};

export async function createRelease(_userId: string, releaseData: ReleaseMutation) {
  try {
    const response = await apiPost<Release>(`/api/releases`, releaseData);

    if (!response.success) {
      throw new Error(response.error || 'Failed to create release');
    }

    return { data: response.data, error: null };
  } catch (error: any) {
    const message = error?.response?.error || error?.message || 'Failed to create release';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Update release
 */
export async function updateRelease(id: string, releaseData: ReleaseMutation) {
  try {
    const response = await apiPut<Release>(`/api/releases/${encodeURIComponent(id)}`, releaseData);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update release');
    }

    return { data: response.data, error: null };
  } catch (error: any) {
    const message = error?.response?.error || error?.message || 'Failed to update release';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Delete release
 */
export async function deleteRelease(id: string) {
  try {
    const response = await apiDelete<any>(`/api/releases/${encodeURIComponent(id)}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete release');
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete release';
    return { error: new Error(message) };
  }
}

/**
 * Submit release for review (Strictly verifies cover artwork and audio master in storage)
 */
export async function submitReleaseForReview(id: string) {
  try {
    const response = await apiPost<Release>(`/api/releases/${encodeURIComponent(id)}/submit`, {});

    if (!response.success) {
      throw new Error(response.error || 'Failed to submit release');
    }

    return { data: response.data, error: null };
  } catch (error: any) {
    const message = error?.response?.error || error?.message || 'Failed to submit release';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Get release status history
 * Read the release status history recorded by the Worker transition.
 */
export async function getReleaseHistory(_releaseId: string) {
  try {
    const response = await apiGet<any[]>(`/api/releases/${encodeURIComponent(_releaseId)}/history`);
    if (!response.success) throw new Error(response.error || 'Failed to fetch release history');
    return { data: response.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch release history';
    return { data: [], error: new Error(message) };
  }
}
