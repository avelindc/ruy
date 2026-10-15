import { apiGet } from '@lib/api/client';
import { ParsedRow } from './csvParserService';

export interface MatchResult {
  trackId?: string;
  releaseId?: string;
  matchType?: 'isrc_owner' | 'isrc_upc_owner' | 'upc_only' | 'no_match';
  matchedBy?: {
    isrc?: boolean;
    upc?: boolean;
  };
}

export interface RowWithMatch extends ParsedRow {
  trackId?: string | null;
  releaseId?: string | null;
  matchType?: 'isrc_owner' | 'isrc_upc_owner' | 'upc_only' | 'no_match';
}

/**
 * Resolve matches for all rows in a batch
 * Priority:
 * 1. ISRC + Owner (HIGHEST - unique per owner)
 * 2. ISRC + UPC + Owner (VERY HIGH)
 * 3. UPC Only (MEDIUM - release level)
 * 4. No Match → track_id/release_id = NULL
 */
export async function resolveMatches(
  rows: ParsedRow[],
  _adminId: string
): Promise<RowWithMatch[]> {
  const results: RowWithMatch[] = [];

  for (const row of rows) {
    const match = await matchRow(row);
    results.push({
      ...row,
      trackId: match.trackId || null,
      releaseId: match.releaseId || null,
      matchType: match.matchType,
    });
  }

  return results;
}

/**
 * Match a single row using priority-based strategy
 */
export async function matchRow(row: ParsedRow): Promise<MatchResult> {
  // Priority 1: ISRC + Owner
  if (row.isrc) {
    const isrcResult = await matchTrackByISRC(row.isrc);
    if (isrcResult.trackId) {
      return {
        ...isrcResult,
        matchType: 'isrc_owner',
        matchedBy: { isrc: true },
      };
    }

    // Priority 2: ISRC + UPC + Owner
    if (row.upc) {
      const combined = await matchTrackByISRCAndUPC(row.isrc, row.upc);
      if (combined.trackId) {
        return {
          ...combined,
          matchType: 'isrc_upc_owner',
          matchedBy: { isrc: true, upc: true },
        };
      }
    }
  }

  // Priority 3: UPC Only
  if (row.upc) {
    const upcResult = await matchReleaseByUPC(row.upc);
    if (upcResult.releaseId) {
      return {
        ...upcResult,
        matchType: 'upc_only',
        matchedBy: { upc: true },
      };
    }
  }

  // Priority 4: No Match
  return {
    matchType: 'no_match',
    matchedBy: {},
  };
}

/**
 * Match track by ISRC (owner-unique)
 */
export async function matchTrackByISRC(
  isrc: string
): Promise<{ trackId?: string; releaseId?: string }> {
  try {
    const response = await apiGet<any>(`/api/tracks?isrc=${encodeURIComponent(isrc)}&limit=1`);
    const track = response.data?.data?.[0];
    return track ? { trackId: track.id, releaseId: track.release_id } : {};
  } catch (error) {
    console.error('Error matching track by ISRC:', error);
    return {};
  }
}

/**
 * Match track by ISRC AND UPC combination (stricter match)
 */
export async function matchTrackByISRCAndUPC(
  isrc: string,
  upc: string
): Promise<{ trackId?: string; releaseId?: string }> {
  try {
    // Get track with matching ISRC
    const trackResponse = await apiGet<any>(`/api/tracks?isrc=${encodeURIComponent(isrc)}&limit=1`);
    const trackData = trackResponse.data?.data?.[0];
    if (!trackData) return {};

    // Verify the track's release has matching UPC
    const releaseResponse = await apiGet<any>(`/api/releases/${encodeURIComponent(trackData.release_id)}`);
    if (releaseResponse.data?.upc === upc) {
      return { trackId: trackData.id, releaseId: trackData.release_id };
    }

    return {};
  } catch (error) {
    console.error('Error matching track by ISRC+UPC:', error);
    return {};
  }
}

/**
 * Match release by UPC (release-level match)
 */
export async function matchReleaseByUPC(
  upc: string
): Promise<{ releaseId?: string }> {
  try {
    const response = await apiGet<any>(`/api/releases/by-upc?upc=${encodeURIComponent(upc)}`);
    return response.data?.id ? { releaseId: response.data.id } : {};
  } catch (error) {
    console.error('Error matching release by UPC:', error);
    return {};
  }
}

/**
 * Get match statistics for a batch of resolved rows
 */
export function getMatchStatistics(rows: RowWithMatch[]): {
  totalRows: number;
  matchedByISRC: number;
  matchedByISRCAndUPC: number;
  matchedByUPC: number;
  unmatched: number;
} {
  return {
    totalRows: rows.length,
    matchedByISRC: rows.filter(r => r.matchType === 'isrc_owner').length,
    matchedByISRCAndUPC: rows.filter(r => r.matchType === 'isrc_upc_owner').length,
    matchedByUPC: rows.filter(r => r.matchType === 'upc_only').length,
    unmatched: rows.filter(r => r.matchType === 'no_match').length,
  };
}
