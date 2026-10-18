/**
 * BREAKOUT MUSIC — Analytics Service (Updated for Workers API)
 *
 * Fetches analytics through the single Cloudflare Worker API.
 * Fetches streaming data from Neon via Workers API.
 */

import { apiGet } from '@lib/api/client';

/**
 * Get streaming records for user
 */
export async function getStreamingRecords(userId: string, startDate?: string, endDate?: string) {
  try {
    const params = new URLSearchParams();
    params.append('artist_id', userId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    params.append('limit', '500');

    const result = await apiGet(`/api/streaming?${params}`);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch streaming records');
    }

    return { data: result.data?.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch streaming records';
    return { data: [], error: new Error(message) };
  }
}

/** Artist-level manual reports are fetched separately from track streaming to avoid double counting. */
export async function getArtistStreamingAggregates(_userId: string) {
  try {
    const result = await apiGet<any>('/api/streaming/aggregates?limit=500');
    if (!result.success) throw new Error(result.error || 'Failed to fetch artist streaming reports');
    return { data: result.data?.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch artist streaming reports';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get streaming stats by period
 */
export async function getStreamingByPeriod(_userId: string) {
  try {
    const result = await apiGet(
      `/api/streaming?limit=1000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch streaming by period');
    }

    const data = result.data?.data || [];

    // Aggregate by period
    const aggregated = data.reduce(
      (acc: any[], record: any) => {
        const existing = acc.find(a => a.period === record.reporting_period);
        if (existing) {
          existing.streams += record.streams || 0;
          existing.revenue += record.revenue || 0;
        } else {
          acc.push({
            period: record.reporting_period,
            streams: record.streams || 0,
            revenue: record.revenue || 0,
          });
        }
        return acc;
      },
      [] as Array<{ period: string; streams: number; revenue: number }>
    );

    return { data: aggregated, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch streaming by period';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get streaming by platform
 */
export async function getStreamingByPlatform(_userId: string) {
  try {
    const result = await apiGet(
      `/api/streaming?limit=1000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch streaming by platform');
    }

    const data = result.data?.data || [];

    // Aggregate by platform
    const aggregated = data.reduce(
      (acc: any[], record: any) => {
        const existing = acc.find(a => a.platform === record.platform);
        if (existing) {
          existing.streams += record.streams || 0;
          existing.revenue += record.revenue || 0;
        } else {
          acc.push({
            platform: record.platform,
            streams: record.streams || 0,
            revenue: record.revenue || 0,
          });
        }
        return acc;
      },
      [] as Array<{ platform: string; streams: number; revenue: number }>
    );

    return { data: aggregated, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch streaming by platform';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get streaming by territory
 */
export async function getStreamingByTerritory(_userId: string, limit = 10) {
  try {
    const result = await apiGet(
      `/api/streaming?limit=1000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch streaming by territory');
    }

    const data = result.data?.data || [];

    // Aggregate by territory and sort by streams
    const aggregated = data
      .reduce(
        (acc: any[], record: any) => {
          const existing = acc.find(a => a.territory === record.territory);
          if (existing) {
            existing.streams += record.streams || 0;
            existing.revenue += record.revenue || 0;
          } else {
            acc.push({
              territory: record.territory,
              streams: record.streams || 0,
              revenue: record.revenue || 0,
            });
          }
          return acc;
        },
        [] as Array<{ territory: string; streams: number; revenue: number }>
      )
      .sort((a: { streams: number }, b: { streams: number }) => b.streams - a.streams)
      .slice(0, limit);

    return { data: aggregated, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch streaming by territory';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get top tracks
 */
export async function getTopTracks(_userId: string, limit = 10) {
  try {
    const result = await apiGet(
      `/api/streaming?limit=1000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch top tracks');
    }

    const data = result.data?.data || [];

    // Aggregate by track and sort by streams
    const trackMap = new Map<string, any>();
    data.forEach((record: any) => {
      const key = record.track_id || record.isrc;
      if (!key) return;

      if (trackMap.has(key)) {
        const existing = trackMap.get(key);
        existing.streams += record.streams || 0;
        existing.revenue += record.revenue || 0;
      } else {
        trackMap.set(key, {
          track_id: record.track_id,
          isrc: record.isrc,
          streams: record.streams || 0,
          revenue: record.revenue || 0,
        });
      }
    });

    const topTracks = Array.from(trackMap.values())
      .sort((a, b) => b.streams - a.streams)
      .slice(0, limit);

    return { data: topTracks, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch top tracks';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get total streaming stats
 */
export async function getTotalStreamingStats(_userId: string) {
  try {
    const result = await apiGet(
      `/api/streaming?limit=10000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch streaming stats');
    }

    const data = result.data?.data || [];

    const stats = {
      totalStreams: data.reduce((sum: number, r: any) => sum + (r.streams || 0), 0),
      totalRevenue: data.reduce((sum: number, r: any) => sum + (r.revenue || 0), 0),
      recordCount: data.length,
    };

    return { data: stats, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch streaming stats';
    return { data: null, error: new Error(message) };
  }
}
