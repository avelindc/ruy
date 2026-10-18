/** Shared response types for release, catalog and streaming API records. */

export interface ReleaseSubmission {
  id: string;
  title: string;
  release_type: 'single' | 'ep' | 'album';
  artist_id?: string;
  artist_name: string;
  genre: string;
  subgenre?: string;
  release_version?: string;
  original_release_date?: string;
  featured_artists?: string[];
  language?: string;
  label_name?: string;
  copyright_c?: string;
  copyright_p?: string;
  notes?: string;
  self_released?: boolean;
  distribution_rights_confirmed?: boolean;
  primary_artist_id?: string;
  tracks?: Array<{
    id?: string;
    title: string;
    track_version?: string;
    primary_artist?: string;
    featured_artists?: string[];
    composers?: string[];
    songwriters?: string[];
    producers?: string[];
    arrangers?: string[];
    track_number?: number;
    disc_number?: number;
    genre?: string;
    language?: string;
    explicit_content?: boolean;
    isrc?: string;
    audio_url?: string;
    rights_ownership?: string;
    distribution_rights_confirmed?: boolean;
  }>;
  release_date: string;
  cover_url: string;
  audio_url?: string;
  audio_name?: string;
  tiktok_clip_start?: string;
  tiktok_clip_duration?: string;
  isrc?: string;
  upc?: string;
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'live';
  rejection_reason?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: string;
  duration: string;
  duration_seconds: number;
  cover_url: string;
  audio_url?: string;
  isrc: string;
  release_date: string;
  added_by: 'admin' | 'user' | 'system';
  created_at: string;
}

export interface StreamingRecordItem {
  id: string;
  user_id?: string;
  artist_name: string;
  track_title: string;
  platform: string;
  period: string;
  streams: number;
  royalty_usd: number;
  currency?: string;
  status?: 'paid' | 'pending' | 'estimated' | 'finalized';
  created_at: string;
}
