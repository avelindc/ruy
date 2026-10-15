// User and Authentication
export type UserRole = 'user' | 'admin' | 'super_admin';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  account_status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends Profile {
  role: UserRole;
}

// Artist
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

// Release
export type ReleaseType = 'single' | 'ep' | 'album';
export type ReleaseStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'delivered' | 'live' | 'takedown';

export interface Release {
  id: string;
  owner_id: string;
  title: string;
  release_type: ReleaseType;
  primary_artist_id: string;
  upc?: string;
  genre?: string;
  label_name?: string;
  artwork_url?: string;
  release_date: string;
  status: ReleaseStatus;
  created_at: string;
  updated_at: string;
}

export interface ReleaseStatusHistory {
  id: string;
  release_id: string;
  previous_status: ReleaseStatus;
  new_status: ReleaseStatus;
  reason?: string;
  actor_id: string;
  created_at: string;
}

// Track
export interface Track {
  id: string;
  release_id: string;
  owner_id: string;
  title: string;
  isrc?: string;
  duration: number;
  genre?: string;
  language?: string;
  explicit_content: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackArtist {
  track_id: string;
  artist_id: string;
  artist_role: string;
}

export interface ReleaseArtist {
  release_id: string;
  artist_id: string;
  artist_role: string;
}

// Streaming & Reporting
export interface StreamingReport {
  id: string;
  owner_id: string;
  source: string;
  reporting_period: string;
  import_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface StreamingRecord {
  id: string;
  report_id: string;
  track_id?: string;
  release_id?: string;
  isrc?: string;
  upc?: string;
  platform: string;
  territory: string;
  reporting_period: string;
  streams: number;
  revenue: number;
  currency: string;
  source_row_hash: string;
}

// Royalties
export interface RoyaltyEntry {
  id: string;
  owner_id: string;
  track_id?: string;
  release_id?: string;
  source_report_id?: string;
  amount: number;
  currency: string;
  reporting_period: string;
  royalty_type: 'streaming' | 'sales' | 'other';
  status: 'estimated' | 'finalized' | 'paid';
  created_at: string;
}

// Wallet & Transactions
export interface Wallet {
  id: string;
  owner_id: string;
  currency: string;
  created_at: string;
}

export type TransactionType = 'royalty_credit' | 'withdrawal' | 'adjustment' | 'refund';

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: string;
  reference_type?: string;
  reference_id?: string;
  idempotency_key?: string;
  created_at: string;
}

// Withdrawal
export type WithdrawalStatus = 'pending' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled';

export interface WithdrawalRequest {
  id: string;
  owner_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  payout_method: string;
  payout_reference?: string;
  status: WithdrawalStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  paid_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

// CSV Import
export interface CSVImport {
  id: string;
  uploaded_by: string;
  source: string;
  filename: string;
  file_hash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_at: string;
  completed_at?: string;
}

export interface CSVImportError {
  id: string;
  import_id: string;
  row_number: number;
  error_code: string;
  error_message: string;
  raw_row: string;
  created_at: string;
}

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  read_at?: string;
  created_at: string;
}

// Support
export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

// Audit Logs
export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// App Settings
export interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
}
