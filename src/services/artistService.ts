/**
 * BREAKOUT MUSIC — Artist Service (Updated for Workers API)
 *
 * Uses the Cloudflare Worker API backed by the configured Neon database.
 */

import type { Artist } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from '@lib/api/client';

/**
 * Get all artists for current user
 */
export async function getUserArtists(userId: string) {
  try {
    const response = await apiGet<any>(`/api/artists?owner_id=${encodeURIComponent(userId)}&limit=100`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch artists');
    }

    return { data: response.data?.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch artists';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get single artist by ID
 */
export async function getArtistById(id: string) {
  try {
    const response = await apiGet<Artist>(`/api/artists/${encodeURIComponent(id)}`);

    if (!response.success) {
      if (response.code === 'NOT_FOUND') {
        return { data: null, error: null };
      }
      throw new Error(response.error || 'Failed to fetch artist');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch artist';
    return { data: null, error: new Error(message) };
  }
}

export async function createArtist(
  userIdOrData: string | (Omit<Artist, 'id' | 'created_at' | 'updated_at'> & { user_id?: string; owner_id?: string }),
  artistData?: Omit<Artist, 'id' | 'owner_id' | 'created_at' | 'updated_at'>
) {
  try {
    let payload: any;
    if (typeof userIdOrData === 'string') {
      payload = {
        owner_id: userIdOrData,
        ...artistData,
      };
    } else {
      const { user_id, owner_id, ...artistDataFields } = userIdOrData;
      payload = { ...artistDataFields, owner_id: owner_id || user_id };
    }

    const response = await apiPost<Artist>(`/api/artists`, payload);

    if (!response.success) {
      throw new Error(response.error || 'Failed to create artist');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create artist';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Update artist
 */
export async function updateArtist(id: string, artistData: Partial<Artist>) {
  try {
    const response = await apiPut<Artist>(`/api/artists/${encodeURIComponent(id)}`, artistData);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update artist');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update artist';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Delete artist
 */
export async function deleteArtist(id: string) {
  try {
    const response = await apiDelete<any>(`/api/artists/${encodeURIComponent(id)}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete artist');
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete artist';
    return { error: new Error(message) };
  }
}

/**
 * Get artist statistics
 */
export async function getArtistStats(artistId: string) {
  try {
    const response = await apiGet<any>(`/api/artists/${encodeURIComponent(artistId)}/stats`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch artist stats');
    }

    return {
      data: response.data,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch artist stats';
    return { data: null, error: new Error(message) };
  }
}
