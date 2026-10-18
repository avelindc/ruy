/**
 * BREAKOUT MUSIC — Database Provider Interface
 *
 * This defines the contract that all database adapters must implement.
 * Neon PostgreSQL records and adapter contracts
 * without changing application code.
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  artist_id?: string;
  password_hash?: string;
  full_name?: string;
  avatar_url?: string;
  account_status: 'active' | 'suspended' | 'deleted';
  role?: 'user' | 'admin' | 'super_admin';
  created_at?: string;
  updated_at?: string;
}

export interface UserInput {
  email: string;
  password_hash?: string;
  full_name?: string;
  avatar_url?: string;
  account_status?: 'active' | 'suspended' | 'deleted';
}

// ============================================================================
// ARTIST TYPES
// ============================================================================

export interface Artist {
  id: string;
  owner_id: string;
  artist_name: string;
  bio?: string;
  genre?: string;
  country?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ArtistInput {
  artist_name: string;
  bio?: string;
  genre?: string;
  country?: string;
  avatar_url?: string;
}

// ============================================================================
// RELEASE TYPES
// ============================================================================

export interface Release {
  id: string;
  owner_id: string;
  title: string;
  release_type: 'single' | 'ep' | 'album';
  primary_artist_id: string;
  genre?: string;
  language?: string;
  upc?: string;
  label_name?: string;
  artwork_url?: string;
  release_date: string; // YYYY-MM-DD
  rejection_reason?: string;
  release_version?: string;
  subgenre?: string;
  original_release_date?: string;
  featured_artists?: string[];
  copyright_c?: string;
  copyright_p?: string;
  notes?: string;
  self_released?: boolean;
  distribution_rights_confirmed?: boolean;
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'delivered' | 'live' | 'takedown';
  created_at: string;
  updated_at: string;
}

export interface ReleaseInput {
  title: string;
  release_type: 'single' | 'ep' | 'album';
  primary_artist_id: string;
  genre?: string;
  language?: string;
  upc?: string;
  label_name?: string;
  artwork_url?: string;
  cover_artwork_url?: string;
  release_date: string;
  release_version?: string;
  subgenre?: string;
  original_release_date?: string;
  featured_artists?: string[];
  copyright_c?: string;
  copyright_p?: string;
  notes?: string;
  self_released?: boolean;
  distribution_rights_confirmed?: boolean;
  tracks?: TrackInput[];
}

// ============================================================================
// TRACK TYPES
// ============================================================================

export interface Track {
  id: string;
  release_id: string;
  owner_id: string;
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
  rights_ownership?: string;
  distribution_rights_confirmed?: boolean;
  audio_url?: string;
  isrc?: string;
  duration?: number; // in seconds
  genre?: string;
  language?: string;
  explicit_content: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackInput {
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
  rights_ownership?: string;
  distribution_rights_confirmed?: boolean;
  audio_url?: string;
  audioUrl?: string;
  isrc?: string;
  upc?: string;
  duration?: number;
  genre?: string;
  language?: string;
  explicit_content?: boolean;
  tiktok_clip_start?: string;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

export interface StreamingRecord {
  id: string;
  report_id?: string;
  track_id?: string;
  release_id?: string;
  isrc?: string;
  upc?: string;
  platform: string;
  territory: string;
  reporting_period: string; // YYYY-MM-DD
  streams: number;
  revenue?: number;
  deductions?: number;
  net_revenue?: number;
  report_period_start?: string;
  report_period_end?: string;
  source_row_reference?: string;
  currency: string;
  source_row_hash?: string;
  track_title?: string;
  artist_name?: string;
  release_title?: string;
  owner_id?: string;
  created_at: string;
}

export interface StreamingFilter {
  owner_id?: string;
  artist_id?: string;
  track_id?: string;
  release_id?: string;
  platform?: string;
  territory?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ArtistStreamingAggregate {
  id: string;
  artist_id: string;
  artist_name: string;
  owner_id: string;
  owner_email?: string;
  account_artist_id?: string;
  platform: string;
  period_start: string;
  period_end: string;
  streams: number;
  territory?: string;
  gross_revenue?: string | number;
  currency?: string;
  report_identifier?: string;
  notes?: string;
  source: 'manual' | 'csv';
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ArtistStreamingAggregateInput {
  artist_id: string;
  platform: string;
  period_start: string;
  period_end: string;
  streams: number;
  territory?: string;
  gross_revenue?: string | number | null;
  currency?: string | null;
  report_identifier?: string | null;
  notes?: string | null;
}

export interface ArtistStreamingAggregateFilter {
  artist_id?: string;
  owner_id?: string;
  platform?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ManualArtistRoyalty {
  id: string;
  artist_id: string;
  artist_name: string;
  owner_id: string;
  owner_email?: string;
  account_artist_id?: string;
  period_start: string;
  period_end: string;
  streams?: number;
  gross_revenue?: string | number;
  deductions: string | number;
  net_royalty: string | number;
  currency: string;
  status: 'draft' | 'finalized' | 'superseded';
  report_identifier?: string;
  notes?: string;
  supersedes_id?: string;
  revision: number;
  created_by: string;
  created_at: string;
}

export interface ManualArtistRoyaltyInput {
  artist_id: string;
  period_start: string;
  period_end: string;
  streams?: number | null;
  gross_revenue?: string | number | null;
  deductions: string | number;
  net_royalty: string | number;
  currency: string;
  status: 'draft' | 'finalized';
  report_identifier?: string | null;
  notes?: string | null;
}

export interface ManualArtistRoyaltyFilter {
  artist_id?: string;
  owner_id?: string;
  start_date?: string;
  end_date?: string;
  include_superseded?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// ROYALTY TYPES
// ============================================================================

export interface RoyaltyEntry {
  id: string;
  owner_id: string;
  track_id?: string;
  release_id?: string;
  song_name?: string;
  streams?: number;
  source_report_id?: string;
  amount: number;
  gross_revenue?: number;
  deductions?: number;
  net_revenue?: number;
  batch_id?: string;
  currency: string;
  reporting_period: string; // YYYY-MM-DD
  royalty_type: 'streaming' | 'sales' | 'other';
  status: 'estimated' | 'finalized' | 'paid';
  created_at: string;
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AuditLogFilter {
  search?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface Withdrawal {
  id: string;
  owner_id: string;
  amount: number;
  currency: string;
  payout_method: string;
  payout_reference?: string;
  status: 'pending' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled';
  reviewed_by?: string;
  reviewed_at?: string;
  paid_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface CsvImport {
  id: string;
  uploaded_by: string;
  source: string;
  filename: string;
  file_hash?: string;
  status: 'pending' | 'processing' | 'partial' | 'completed' | 'failed';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows?: number;
  report_identifier?: string;
  period_start?: string;
  period_end?: string;
  currency?: string | null;
  created_at: string;
  completed_at?: string;
}

export interface ReleaseStatusHistory {
  id: string;
  release_id: string;
  previous_status?: string;
  new_status: string;
  reason?: string;
  actor_id?: string;
  created_at: string;
}

export interface RoyaltyRuleInput {
  artist_id: string;
  platform: string;
  share_percent: number;
  revenue_basis: 'gross' | 'net';
  currency: 'USD';
  effective_from: string;
  effective_until?: string | null;
}

// ============================================================================
// CMS TYPES
// ============================================================================

export interface CmsLandingSection {
  id: string;
  section_key: string;
  name: string;
  title: string;
  subtitle?: string;
  sort_order: number;
  is_enabled: boolean;
  content_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CmsTestimonial {
  id: string;
  artist_name: string;
  avatar_url?: string;
  role_label?: string;
  quote: string;
  sort_order: number;
  status: 'published' | 'draft';
  created_at?: string;
  updated_at?: string;
}

export interface CmsFaqCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  sort_order: number;
  status: 'published' | 'draft';
  items?: CmsFaqItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CmsFaqItem {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  sort_order: number;
  status: 'published' | 'draft';
  created_at?: string;
  updated_at?: string;
}

export interface CmsScrollytellingStep {
  step_index: number;
  badge: string;
  title: string;
  description: string;
  alignment: 'left' | 'center' | 'right';
  start_progress: number;
  end_progress: number;
  is_active: boolean;
}

export interface CmsScrollytellingFrame {
  id: string;
  scrollytelling_id: string;
  frame_index: number;
  frame_url: string;
  created_at?: string;
}

export interface CmsScrollytelling {
  id: string;
  is_enabled: boolean;
  status: 'published' | 'draft';
  bg_color: string;
  scroll_height_vh: number;
  canvas_aspect_ratio: string;
  cta_label: string;
  cta_url: string;
  text_steps: CmsScrollytellingStep[];
  frames: CmsScrollytellingFrame[];
  updated_at?: string;
}

// ============================================================================
// DATABASE ADAPTER INTERFACE
// ============================================================================

export interface DatabaseAdapter {
  // ========== USER OPERATIONS ==========
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  listUsers(limit?: number, offset?: number, search?: string): Promise<{ data: User[]; total: number }>;
  createUser(data: UserInput): Promise<User>;
  updateUser(userId: string, data: Partial<UserInput>): Promise<User>;
  createAuthSession(userId: string, tokenId: string, expiresAt: Date): Promise<void>;
  isAuthSessionValid(userId: string, tokenId: string): Promise<boolean>;
  revokeAuthSession(userId: string, tokenId: string): Promise<void>;
  getAdminDashboardStats(): Promise<{
    totalUsers: number;
    totalReleases: number;
    totalStreams: number;
    totalRevenue: number;
    pendingReviews: number;
    pendingWithdrawals: number;
  }>;
  hasStreamingDuplicate(sourceRowHash: string): Promise<boolean>;
  hasStreamingIdentityDuplicate(sourceRowIdentity: string): Promise<boolean>;

  // ========== ARTIST OPERATIONS ==========
  getArtist(artistId: string): Promise<Artist | null>;
  listArtists(ownerId?: string, limit?: number, offset?: number): Promise<{ data: Artist[]; total: number }>;
  createArtist(ownerId: string, data: ArtistInput): Promise<Artist>;
  updateArtist(artistId: string, data: Partial<ArtistInput>): Promise<Artist>;
  deleteArtist(artistId: string): Promise<void>;

  // ========== RELEASE OPERATIONS ==========
  getRelease(releaseId: string): Promise<Release | null>;
  listReleases(ownerId?: string, limit?: number, offset?: number): Promise<{ data: Release[]; total: number }>;
  listReleasesByArtist(artistId: string, limit?: number, offset?: number): Promise<{ data: Release[]; total: number }>;
  createRelease(ownerId: string, data: ReleaseInput): Promise<Release>;
  updateRelease(releaseId: string, data: Partial<ReleaseInput>): Promise<Release>;
  deleteRelease(releaseId: string): Promise<void>;
  getReleasByUpc(upc: string): Promise<Release | null>;

  // ========== TRACK OPERATIONS ==========
  getTrack(trackId: string): Promise<Track | null>;
  listTracks(releaseId: string, limit?: number, offset?: number): Promise<{ data: Track[]; total: number }>;
  createTrack(releaseId: string, ownerId: string, data: TrackInput): Promise<Track>;
  updateTrack(trackId: string, data: Partial<TrackInput>): Promise<Track>;
  deleteTrack(trackId: string): Promise<void>;
  getTrackByIsrc(isrc: string): Promise<Track | null>;
  listTracksByIsrc(isrcList: string[]): Promise<Track[]>;

  // ========== STREAMING OPERATIONS ==========
  getStreamingRecords(filters: StreamingFilter): Promise<{ data: StreamingRecord[]; total: number }>;
  createStreamingRecord(data: StreamingRecord): Promise<StreamingRecord>;
  createStreamingRecords(data: StreamingRecord[]): Promise<StreamingRecord[]>;
  getStreamingByPeriod(artistId: string, startDate: string, endDate: string): Promise<StreamingRecord[]>;
  listArtistFinanceArtists(): Promise<Array<{ id: string; artist_name: string; owner_id: string; owner_email: string; account_artist_id?: string }>>;
  listArtistStreamingAggregates(filters: ArtistStreamingAggregateFilter): Promise<{ data: ArtistStreamingAggregate[]; total: number }>;
  createArtistStreamingAggregate(data: ArtistStreamingAggregateInput, actorId: string): Promise<ArtistStreamingAggregate>;
  correctArtistStreamingAggregate(id: string, data: ArtistStreamingAggregateInput, actorId: string): Promise<ArtistStreamingAggregate>;
  listManualArtistRoyalties(filters: ManualArtistRoyaltyFilter): Promise<{ data: ManualArtistRoyalty[]; total: number }>;
  createManualArtistRoyalty(data: ManualArtistRoyaltyInput, actorId: string): Promise<ManualArtistRoyalty>;
  correctManualArtistRoyalty(id: string, data: Omit<ManualArtistRoyaltyInput, 'artist_id'>, actorId: string, reason: string): Promise<ManualArtistRoyalty>;

  // ========== ROYALTY OPERATIONS ==========
  getRoyalties(artistId: string, limit?: number, offset?: number): Promise<{ data: RoyaltyEntry[]; total: number }>;
  getRoyaltiesByPeriod(artistId: string, startDate: string, endDate: string): Promise<RoyaltyEntry[]>;
  getRoyaltyTotal(artistId: string): Promise<number>;
  getRoyaltyCalculationItemsForOwner(userId: string, limit?: number, offset?: number): Promise<{ data: any[]; total: number }>;
  listRoyaltyRules(artistId?: string): Promise<any[]>;
  createRoyaltyRule(data: RoyaltyRuleInput, adminId: string): Promise<any>;
  processStreamingReportRoyalties(reportId: string, adminId: string): Promise<string>;
  getFinancialLedger(userId?: string, limit?: number, offset?: number): Promise<{ data: any[]; total: number }>;
  getFinancialLedgerSummary(userId: string): Promise<Array<{ currency: string; balance: number; total_earned: number; total_withdrawn: number }>>;

  // ========== ADMIN OPERATIONS ==========
  getAuditLogs(filters: AuditLogFilter): Promise<{ data: AuditLog[]; total: number }>;
  createAuditLog(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog>;

  getWithdrawals(filters?: { status?: string; owner_id?: string; limit?: number; offset?: number }): Promise<{ data: Withdrawal[]; total: number }>;
  createWithdrawal(data: Pick<Withdrawal, 'owner_id' | 'amount' | 'currency' | 'payout_method' | 'payout_reference'>): Promise<Withdrawal>;
  updateWithdrawalStatus(withdrawalId: string, status: string, reason?: string, reviewedBy?: string): Promise<Withdrawal>;

  listNotifications(userId: string, limit: number, offset: number): Promise<{ data: NotificationRecord[]; total: number }>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(userId: string, notificationId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(userId: string, notificationId: string): Promise<void>;
  deleteAllNotifications(userId: string): Promise<void>;

  getReleasesByStatus(status: string, limit?: number, offset?: number): Promise<{ data: Release[]; total: number }>;
  updateReleaseStatus(releaseId: string, newStatus: string, reason?: string, actorId?: string): Promise<Release>;
  getReleaseStatusHistory(releaseId: string): Promise<Array<{ previous_status?: string; new_status: string; reason?: string; actor_id?: string; actor_name?: string; created_at: string }>>;

  createCsvImport(data: Omit<CsvImport, 'id' | 'created_at'>): Promise<CsvImport>;
  getCsvImportStatus(importId: string): Promise<CsvImport | null>;
  updateCsvImport(importId: string, data: Partial<Pick<CsvImport, 'status' | 'valid_rows' | 'invalid_rows' | 'duplicate_rows' | 'completed_at'>>): Promise<void>;
  createCsvImportErrors(importId: string, errors: Array<{ row_number: number; error_code: string; error_message: string; raw_row?: string }>): Promise<void>;
  getCsvImportErrors(importId: string, limit: number, offset: number): Promise<Array<{ row_number: number; error_code: string; error_message: string; raw_row: string }>>;
  listCsvImports(filters: { source?: string; status?: string; start_date?: string; end_date?: string; limit: number; offset: number }): Promise<{ data: CsvImport[]; total: number }>;
  getStreamingRecordsByImport(importId: string, limit: number, offset: number): Promise<StreamingRecord[]>;

  // ========== CMS OPERATIONS ==========
  initCmsTables?(): Promise<void>;
  getLandingContent?(): Promise<{
    sections: CmsLandingSection[];
    testimonials: CmsTestimonial[];
    faq_categories: CmsFaqCategory[];
    scrollytelling?: CmsScrollytelling | null;
  }>;
  listCmsTestimonials?(publishedOnly?: boolean): Promise<CmsTestimonial[]>;
  createCmsTestimonial?(data: Partial<CmsTestimonial>): Promise<CmsTestimonial>;
  updateCmsTestimonial?(id: string, data: Partial<CmsTestimonial>): Promise<CmsTestimonial>;
  deleteCmsTestimonial?(id: string): Promise<void>;
  listCmsFaqCategories?(publishedOnly?: boolean): Promise<CmsFaqCategory[]>;
  createCmsFaqCategory?(data: Partial<CmsFaqCategory>): Promise<CmsFaqCategory>;
  updateCmsFaqCategory?(id: string, data: Partial<CmsFaqCategory>): Promise<CmsFaqCategory>;
  deleteCmsFaqCategory?(id: string): Promise<void>;
  listCmsFaqItems?(categoryId?: string, publishedOnly?: boolean): Promise<CmsFaqItem[]>;
  createCmsFaqItem?(data: Partial<CmsFaqItem>): Promise<CmsFaqItem>;
  updateCmsFaqItem?(id: string, data: Partial<CmsFaqItem>): Promise<CmsFaqItem>;
  deleteCmsFaqItem?(id: string): Promise<void>;
  listCmsSections?(enabledOnly?: boolean): Promise<CmsLandingSection[]>;
  updateCmsSection?(id: string, data: Partial<CmsLandingSection>): Promise<CmsLandingSection>;
  getScrollytelling?(publishedOnly?: boolean): Promise<CmsScrollytelling | null>;
  updateScrollytelling?(data: Partial<CmsScrollytelling>): Promise<CmsScrollytelling>;
  addScrollytellingFrame?(frameUrl: string, frameIndex?: number): Promise<CmsScrollytellingFrame>;
  deleteScrollytellingFrame?(frameId: string): Promise<void>;
  reorderScrollytellingFrames?(frameIds: string[]): Promise<void>;
  // ========== STORAGE OPERATIONS ==========
  saveUploadChunks?(uploadId: string, chunks: string[]): Promise<void>;
  getUploadChunks?(uploadId: string): Promise<string[] | null>;
  verifyUploadExists?(uploadId: string): Promise<boolean>;

  // ========== UTILITY OPERATIONS ==========
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string = 'DB_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends DatabaseError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends DatabaseError {
  constructor(message: string) {
    super(message, 'FORBIDDEN', 403);
    this.name = 'AuthorizationError';
  }
}
