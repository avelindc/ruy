/**
 * BREAKOUT MUSIC — Royalties Service (Updated for Workers API)
 *
 * Fetches royalty data through the single Cloudflare Worker API.
 * Fetches royalty data from Neon via Workers API.
 */

import { apiGet } from '@lib/api/client';

/**
 * Get royalty entries for user
 */
export async function getRoyaltyEntries(_userId: string) {
  try {
    const result = await apiGet(
      `/api/royalties?limit=500`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch royalty entries');
    }

    return { data: result.data?.data || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch royalty entries';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Get royalty summary
 */
export async function getRoyaltySummary(_userId: string) {
  try {
    const result = await apiGet(
      `/api/royalties?limit=10000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch royalty summary');
    }

    const data = result.data?.data || [];

    const summary = {
      totalRoyalties: data.reduce((sum: number, r: any) => sum + (r.amount || 0), 0),
      pendingRoyalties: data
        .filter((r: any) => r.status === 'estimated')
        .reduce((sum: number, r: any) => sum + (r.amount || 0), 0),
      paidRoyalties: data
        .filter((r: any) => r.status === 'paid')
        .reduce((sum: number, r: any) => sum + (r.amount || 0), 0),
      heldRoyalties: data
        .filter((r: any) => r.status === 'finalized')
        .reduce((sum: number, r: any) => sum + (r.amount || 0), 0),
      entryCount: data.length,
    };

    return { data: summary, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch royalty summary';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Get royalties by release
 */
export async function getRoyaltiesByRelease(_userId: string) {
  try {
    const result = await apiGet(
      `/api/royalties?limit=10000`
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch royalties by release');
    }

    const data = result.data?.data || [];

    // Group by release
    const grouped = data.reduce(
      (acc: any[], entry: any) => {
        const releaseId = entry.release_id;
        const existing = acc.find(g => g.releaseId === releaseId);
        if (existing) {
          existing.totalAmount += entry.amount || 0;
          if (entry.status === 'paid') existing.paidAmount += entry.amount || 0;
          if (entry.status === 'estimated') existing.pendingAmount += entry.amount || 0;
          if (entry.status === 'finalized') existing.heldAmount += entry.amount || 0;
        } else {
          acc.push({
            releaseId,
            releaseTitle: 'Release ' + (releaseId?.slice(0, 8) || 'Unknown'),
            totalAmount: entry.amount || 0,
            paidAmount: entry.status === 'paid' ? entry.amount || 0 : 0,
            pendingAmount: entry.status === 'estimated' ? entry.amount || 0 : 0,
            heldAmount: entry.status === 'finalized' ? entry.amount || 0 : 0,
          });
        }
        return acc;
      },
      [] as Array<{
        releaseId: string;
        releaseTitle: string;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        heldAmount: number;
      }>
    );

    return { data: grouped, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch royalties by release';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Update royalty status
 * TODO: Implement when royalty update endpoint is created
 */
export async function updateRoyaltyStatus(
  _royaltyId: string,
  _status: 'pending' | 'paid' | 'held' | 'disputed'
) {
  return { error: new Error('Updating royalty status is not available yet.') };
}
