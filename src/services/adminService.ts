import { apiGet, apiPut } from '@lib/api/client';

export async function getAdminStats() {
  try {
    const response = await apiGet('/api/admin/dashboard-stats');
    return { data: response.data || null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to fetch admin stats') };
  }
}

export async function getPendingReleases(limit = 10, offset = 0) {
  try {
    const params = new URLSearchParams({ status: 'in_review', limit: String(limit), offset: String(offset) });
    const response = await apiGet<any>(`/api/admin/releases-review?${params}`);
    const data = Array.isArray(response.data) ? response.data : [];
    return { data, total: response.data?.total || data.length, error: null };
  } catch (error) {
    return { data: [], total: 0, error: error instanceof Error ? error : new Error('Failed to fetch pending releases') };
  }
}

export async function getRecentActivity(limit = 20) {
  try {
    const response = await apiGet<any>(`/api/admin/audit-logs?limit=${limit}`);
    return { data: response.data?.data || [], error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error : new Error('Failed to fetch recent activity') };
  }
}

export async function getUsersWithStats(limit = 20, offset = 0, search?: string) {
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search?.trim()) params.set('search', search.trim());
    const response = await apiGet<any>(`/api/admin/users?${params}`);
    return { data: response.data?.data || [], total: response.data?.total || 0, error: null };
  } catch (error) {
    return { data: [], total: 0, error: error instanceof Error ? error : new Error('Failed to fetch users') };
  }
}

export async function getUserDetail(userId: string) {
  try {
    const response = await apiGet(`/api/admin/users/${encodeURIComponent(userId)}`);
    return { data: response.data || null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to fetch user detail') };
  }
}

export async function getArtistCatalog(artistId: string) {
  try {
    const [artistResponse, releaseResponse] = await Promise.all([
      apiGet<any>(`/api/artists/${encodeURIComponent(artistId)}`),
      apiGet<any>(`/api/releases?artist_id=${encodeURIComponent(artistId)}&limit=100`),
    ]);
    const releases = releaseResponse.data?.data || [];
    return {
      data: {
        artist: artistResponse.data,
        releases,
        totalReleases: releaseResponse.data?.total || releases.length,
        totalTracks: releases.reduce((sum: number, release: any) => sum + (release.tracks?.length || 0), 0),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to fetch artist catalog') };
  }
}

export async function getArtistsList(limit = 20, offset = 0) {
  try {
    const response = await apiGet<any>(`/api/artists?limit=${limit}&offset=${offset}`);
    const artists = response.data?.data || [];
    return {
      data: artists.map((artist: any) => ({ ...artist, releaseCount: Number(artist.releaseCount || 0) })),
      total: response.data?.total || 0,
      error: null,
    };
  } catch (error) {
    return { data: [], total: 0, error: error instanceof Error ? error : new Error('Failed to fetch artists') };
  }
}

async function setUserStatus(userId: string, status: 'active' | 'suspended') {
  try {
    await apiPut(`/api/admin/users/${encodeURIComponent(userId)}/status`, { status });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to update account status') };
  }
}

export const suspendUser = (userId: string) => setUserStatus(userId, 'suspended');
export const reactivateUser = (userId: string) => setUserStatus(userId, 'active');
