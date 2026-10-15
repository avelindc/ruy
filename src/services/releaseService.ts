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
export async function createRelease(
  userId: string,
  releaseData: Partial<Release> & {
    title: string;
    release_type?: 'single' | 'ep' | 'album';
    primary_artist_id?: string;
    cover_artwork_url?: string;
    artwork_url?: string;
    genre?: string;
    release_date?: string;
    tracks?: any[];
  }
) {
  try {
    const response = await apiPost<Release>(`/api/releases`, {
      owner_id: userId,
      status: 'draft',
      ...releaseData,
    });

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
export async function updateRelease(id: string, releaseData: Partial<Release> & { tracks?: any[] }) {
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
 * TODO: Implement when status history table is added to adapter
 */
export async function getReleaseHistory(_releaseId: string) {
  try {
    // For now, return empty array as status history is not yet in the Neon adapter
    return { data: [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch release history';
    return { data: [], error: new Error(message) };
  }
}
