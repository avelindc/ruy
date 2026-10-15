/**
 * Breakout Music track API client.
 */

import type { Track } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from '@lib/api/client';

/**
 * Get all tracks for a release
 */
export async function getReleaseTracklist(releaseId: string) {
  try {
    const response = await apiGet<any>(`/api/tracks?release_id=${encodeURIComponent(releaseId)}&limit=500`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch tracks');
    }

    return { data: response.data?.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tracks';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get all tracks for current user
 * TODO: Filter by owner_id when adapter supports it
 */
export async function getUserTracks(userId: string) {
  try {
    const response = await apiGet<any>(`/api/tracks?limit=500`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch tracks');
    }

    // Filter by owner_id on client
    const filtered = (response.data?.data || []).filter((t: Track) => t.owner_id === userId);
    return { data: filtered, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tracks';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get single track by ID
 */
export async function getTrackById(id: string) {
  try {
    const response = await apiGet<Track>(`/api/tracks/${encodeURIComponent(id)}`);

    if (!response.success) {
      if (response.code === 'NOT_FOUND') {
        return { data: null, error: null };
      }
      throw new Error(response.error || 'Failed to fetch track');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch track';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Create new track
 */
export async function createTrack(
  userId: string,
  trackData: Omit<Track, 'id' | 'owner_id' | 'created_at' | 'updated_at'>
) {
  try {
    const response = await apiPost<Track>(`/api/tracks`, {
      owner_id: userId,
      ...trackData,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to create track');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create track';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Update track
 */
export async function updateTrack(id: string, trackData: Partial<Track>) {
  try {
    const response = await apiPut<Track>(`/api/tracks/${encodeURIComponent(id)}`, trackData);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update track');
    }

    return { data: response.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update track';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Delete track
 */
export async function deleteTrack(id: string) {
  try {
    const response = await apiDelete<any>(`/api/tracks/${encodeURIComponent(id)}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete track');
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete track';
    return { error: new Error(message) };
  }
}

/**
 * Check if ISRC is unique
 * TODO: Implement via Workers API once adapter supports ISRC lookup
 */
export async function checkISRCUnique(isrc: string, _userId: string, excludeTrackId?: string) {
  try {
    const response = await apiGet<any>(`/api/tracks?isrc=${encodeURIComponent(isrc)}`);

    if (!response.success) {
      return { isUnique: true, error: null };
    }

    const tracks = response.data?.data || [];
    const filtered = excludeTrackId ? tracks.filter((t: Track) => t.id !== excludeTrackId) : tracks;

    return { isUnique: filtered.length === 0, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check ISRC';
    return { isUnique: false, error: new Error(message) };
  }
}
