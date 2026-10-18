/**
 * BREAKOUT MUSIC — Neon Schema Transformers
 *
 * Transforms Neon PostgreSQL schema to BREAKOUT MUSIC types.
 * Handles differences in naming, data types, and relationships.
 */

import type {
  User,
  Artist,
  Release,
  Track,
  StreamingRecord,
  RoyaltyEntry,
} from '../types/database';

// ============================================================================
// USER TRANSFORMER
// ============================================================================

export interface NeonUser {
  id: string;
  email: string;
  artist_id?: string | null;
  password_hash: string;
  full_name?: string;
  avatar_url?: string;
  account_status?: string; // active, suspended, deleted
  email_verified?: boolean;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  role?: string; // from user_roles table join
}

export function transformNeonUser(neonUser: NeonUser): User {
  return {
    id: neonUser.id,
    artist_id: neonUser.artist_id || undefined,
    full_name: neonUser.full_name || '',
    email: neonUser.email,
    avatar_url: neonUser.avatar_url || undefined,
    account_status: mapNeonUserStatus(neonUser.account_status || 'active'),
    role: mapNeonRole(neonUser.role || 'user'),
    created_at: neonUser.created_at,
    updated_at: neonUser.updated_at,
    password_hash: neonUser.password_hash, // Include for auth verification
  };
}

function mapNeonUserStatus(neonStatus: string): 'active' | 'suspended' | 'deleted' {
  switch (neonStatus.toLowerCase()) {
    case 'active':
      return 'active';
    case 'suspended':
      return 'suspended';
    case 'deleted':
      return 'deleted';
    default:
      return 'active'; // Default to active for unmatched statuses
  }
}

function mapNeonRole(neonRole: string): 'user' | 'admin' | 'super_admin' {
  switch ((neonRole || '').toLowerCase().trim()) {
    case 'admin':
    case 'artist_manager':
      return 'admin';
    case 'super_admin':
    case 'superadmin':
      return 'super_admin';
    case 'user':
    default:
      return 'user';
  }
}

// ============================================================================
// ARTIST TRANSFORMER
// ============================================================================

export interface NeonArtist {
  id: string;
  userId: string;
  stageName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export function transformNeonArtist(neonArtist: NeonArtist): Artist {
  return {
    id: neonArtist.id,
    owner_id: neonArtist.userId,
    artist_name: neonArtist.stageName,
    bio: neonArtist.bio || undefined,
    genre: undefined, // Not in Neon, set via Release.genre
    country: undefined, // Not in Neon
    avatar_url: neonArtist.avatarUrl || undefined,
    created_at: neonArtist.createdAt,
    updated_at: neonArtist.updatedAt,
  };
}

// ============================================================================
// RELEASE TRANSFORMER
// ============================================================================

export interface NeonRelease {
  id: string;
  artistId: string;
  title: string;
  type: string; // SINGLE, EP, ALBUM, MIXTAPE, etc.
  genre: string;
  language: string;
  releaseDate: string; // YYYY-MM-DDTHH:MM:SS.SSSZ
  coverArtworkUrl: string;
  status: string; // DRAFT, SUBMITTED, APPROVED, RELEASED, etc.
  isImported: boolean;
  upc?: string;
  distributor?: string;
  createdAt: string;
  updatedAt: string;
}

export function transformNeonRelease(neonRelease: NeonRelease, ownerId: string): Release {
  return {
    id: neonRelease.id,
    owner_id: ownerId,
    title: neonRelease.title,
    release_type: mapNeonReleaseType(neonRelease.type),
    primary_artist_id: neonRelease.artistId,
    upc: neonRelease.upc || undefined,
    label_name: neonRelease.distributor || undefined,
    artwork_url: neonRelease.coverArtworkUrl,
    release_date: formatDateToISO(neonRelease.releaseDate),
    status: mapNeonReleaseStatus(neonRelease.status),
    created_at: neonRelease.createdAt,
    updated_at: neonRelease.updatedAt,
  };
}

function mapNeonReleaseType(neonType: string): 'single' | 'ep' | 'album' {
  switch (neonType.toUpperCase()) {
    case 'SINGLE':
      return 'single';
    case 'EP':
      return 'ep';
    case 'ALBUM':
    case 'MIXTAPE':
      return 'album';
    default:
      return 'single';
  }
}

function mapNeonReleaseStatus(
  neonStatus: string
): 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'delivered' | 'live' | 'takedown' {
  switch (neonStatus ? neonStatus.toUpperCase() : '') {
    case 'PENDING':
    case 'DRAFT':
      return 'draft';
    case 'REVIEW':
    case 'SUBMITTED':
      return 'submitted';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'RELEASED':
    case 'LIVE':
      return 'live';
    case 'PROCESSING':
    case 'DELIVERED':
      return 'delivered';
    case 'TAKEDOWN':
      return 'takedown';
    case 'IN_REVIEW':
    default:
      return 'in_review';
  }
}

// ============================================================================
// TRACK TRANSFORMER
// ============================================================================

export interface NeonTrack {
  id: string;
  releaseId: string;
  title: string;
  audioUrl?: string;
  isrc?: string;
  upc?: string;
  composer?: string;
  producer?: string;
  lyrics?: string;
  featuredArtist?: string;
  createdAt: string;
  updatedAt: string;
}

export function transformNeonTrack(neonTrack: NeonTrack, ownerId: string, genre?: string, language?: string): Track {
  return {
    id: neonTrack.id,
    release_id: neonTrack.releaseId,
    owner_id: ownerId,
    title: neonTrack.title,
    audio_url: neonTrack.audioUrl || undefined,
    isrc: neonTrack.isrc || undefined,
    duration: undefined, // Not in Neon; would require audio file processing
    genre: genre || undefined,
    language: language || undefined,
    explicit_content: false, // Default to false if not specified
    created_at: neonTrack.createdAt,
    updated_at: neonTrack.updatedAt,
  };
}

// ============================================================================
// STREAMING TRANSFORMER
// ============================================================================

export interface NeonStreaming {
  id: string;
  trackId?: string;
  releaseId?: string;
  reportId?: string;
  platform: string;
  country?: string;
  playCount: number;
  date: string;
  revenue?: number | string | null;
  currency?: string;
  trackTitle?: string;
  artistName?: string;
  releaseTitle?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export function transformNeonStreaming(neonStreaming: NeonStreaming, isrc?: string): StreamingRecord {
  return {
    id: neonStreaming.id,
    report_id: neonStreaming.reportId || undefined,
    track_id: neonStreaming.trackId || undefined,
    release_id: neonStreaming.releaseId || undefined,
    isrc: isrc || undefined,
    platform: neonStreaming.platform,
    territory: neonStreaming.country || 'XX',
    reporting_period: formatDateToISO(neonStreaming.date),
    streams: neonStreaming.playCount,
    revenue: neonStreaming.revenue == null ? undefined : Number(neonStreaming.revenue),
    currency: neonStreaming.currency || 'USD',
    track_title: neonStreaming.trackTitle || undefined,
    artist_name: neonStreaming.artistName || undefined,
    release_title: neonStreaming.releaseTitle || undefined,
    owner_id: neonStreaming.ownerId || undefined,
    created_at: neonStreaming.createdAt,
  };
}

// ============================================================================
// ROYALTY TRANSFORMER
// ============================================================================

export interface NeonRoyalty {
  id: string;
  artistId: string;
  songName: string;
  month: number;
  year: number;
  spotifyStreams: number;
  appleMusicStreams: number;
  youtubeStreams: number;
  tiktokStreams: number;
  amazonStreams: number;
  otherStreams: number;
  platformData?: Record<string, any>;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
}

export function transformNeonRoyalty(neonRoyalty: NeonRoyalty, trackId?: string): RoyaltyEntry {
  const date = new Date(neonRoyalty.year, neonRoyalty.month - 1, 1);

  return {
    id: neonRoyalty.id,
    owner_id: neonRoyalty.artistId,
    track_id: trackId || undefined,
    song_name: neonRoyalty.songName,
    streams: Number(neonRoyalty.spotifyStreams || 0) + Number(neonRoyalty.appleMusicStreams || 0)
      + Number(neonRoyalty.youtubeStreams || 0) + Number(neonRoyalty.tiktokStreams || 0)
      + Number(neonRoyalty.amazonStreams || 0) + Number(neonRoyalty.otherStreams || 0),
    source_report_id: undefined, // Not tracked in Neon
    amount: neonRoyalty.totalRevenue,
    currency: 'USD',
    reporting_period: date.toISOString().split('T')[0],
    royalty_type: 'streaming',
    status: 'finalized', // Neon royalties are always finalized
    created_at: neonRoyalty.createdAt,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert various date formats to ISO 8601 (YYYY-MM-DD)
 */
function formatDateToISO(dateString: string): string {
  if (!dateString) return new Date().toISOString().split('T')[0];

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    // Fallback if date is invalid
    return new Date().toISOString().split('T')[0];
  }

  return date.toISOString().split('T')[0];
}

/**
 * Compute SHA-256 hash for deduplication
 * (Note: Cloudflare Workers crypto is available via SubtleCrypto)
 */
export async function computeRowHash(data: Record<string, any>): Promise<string> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// ============================================================================
