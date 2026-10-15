-- Breakout Music initial schema for a new, empty Neon database.
-- This file only creates schema. It imports no users or business data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deleted')),
  email_verified boolean NOT NULL DEFAULT false,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX user_sessions_active_idx ON user_sessions(user_id, token_jti, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE "Artist" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "stageName" text NOT NULL,
  bio text,
  "avatarUrl" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX artist_owner_idx ON "Artist"("userId");

CREATE TABLE "Release" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artistId" uuid NOT NULL REFERENCES "Artist"(id) ON DELETE RESTRICT,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('SINGLE', 'EP', 'ALBUM')),
  genre text,
  language text,
  "primaryArtist" text,
  "releaseDate" date NOT NULL,
  "coverArtworkUrl" text,
  status text NOT NULL DEFAULT 'PENDING',
  "isImported" boolean NOT NULL DEFAULT false,
  upc text,
  distributor text,
  "rejectionReason" text,
  "transferReference" text,
  "reviewedBy" uuid REFERENCES users(id) ON DELETE SET NULL,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX release_artist_idx ON "Release"("artistId");
CREATE INDEX release_status_idx ON "Release"(status);
CREATE UNIQUE INDEX release_upc_idx ON "Release"(upc) WHERE upc IS NOT NULL;

CREATE TABLE "Track" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "releaseId" uuid NOT NULL REFERENCES "Release"(id) ON DELETE CASCADE,
  title text NOT NULL,
  "audioUrl" text,
  isrc text,
  upc text,
  duration integer,
  "explicitContent" boolean NOT NULL DEFAULT false,
  language text,
  "tiktokClipStart" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX track_release_idx ON "Track"("releaseId");
CREATE UNIQUE INDEX track_isrc_idx ON "Track"(isrc) WHERE isrc IS NOT NULL;

CREATE TABLE "Streaming" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trackId" uuid REFERENCES "Track"(id) ON DELETE SET NULL,
  "releaseId" uuid REFERENCES "Release"(id) ON DELETE SET NULL,
  "reportId" uuid,
  platform text NOT NULL,
  country text,
  "playCount" bigint NOT NULL DEFAULT 0 CHECK ("playCount" >= 0),
  date date NOT NULL,
  revenue numeric(16,6),
  currency text NOT NULL DEFAULT 'USD',
  "sourceRowHash" text UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX streaming_track_date_idx ON "Streaming"("trackId", date);

CREATE TABLE "Royalty" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artistId" uuid NOT NULL REFERENCES "Artist"(id) ON DELETE CASCADE,
  "songName" text NOT NULL,
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year smallint NOT NULL,
  "spotifyStreams" bigint NOT NULL DEFAULT 0,
  "appleMusicStreams" bigint NOT NULL DEFAULT 0,
  "youtubeStreams" bigint NOT NULL DEFAULT 0,
  "tiktokStreams" bigint NOT NULL DEFAULT 0,
  "amazonStreams" bigint NOT NULL DEFAULT 0,
  "otherStreams" bigint NOT NULL DEFAULT 0,
  "platformData" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "totalRevenue" numeric(16,6) NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("artistId", "songName", month, year)
);

CREATE TABLE "AuditLog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditlog_created_idx ON "AuditLog"("createdAt" DESC);

CREATE TABLE "Withdrawal" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(16,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  "payoutMethod" text NOT NULL,
  "payoutReference" text,
  status text NOT NULL DEFAULT 'pending',
  "reviewedBy" uuid REFERENCES users(id) ON DELETE SET NULL,
  "reviewedAt" timestamptz,
  "paidAt" timestamptz,
  "rejectionReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX withdrawal_owner_status_idx ON "Withdrawal"("userId", status);

CREATE TABLE "ReleaseStatusHistory" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "releaseId" uuid NOT NULL REFERENCES "Release"(id) ON DELETE CASCADE,
  "previousStatus" text,
  "newStatus" text NOT NULL,
  reason text,
  "actorId" uuid REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "CsvImport" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "uploadedBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source text NOT NULL,
  filename text NOT NULL,
  "fileHash" text,
  status text NOT NULL DEFAULT 'pending',
  "totalRows" integer NOT NULL DEFAULT 0,
  "validRows" integer NOT NULL DEFAULT 0,
  "invalidRows" integer NOT NULL DEFAULT 0,
  "duplicateRows" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz
);

CREATE TABLE "CsvImportError" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "importId" uuid NOT NULL REFERENCES "CsvImport"(id) ON DELETE CASCADE,
  "rowNumber" integer NOT NULL,
  "errorCode" text NOT NULL,
  "errorMessage" text NOT NULL,
  "rawRow" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "Streaming" ADD CONSTRAINT streaming_import_fk
  FOREIGN KEY ("reportId") REFERENCES "CsvImport"(id) ON DELETE SET NULL;
CREATE INDEX csv_import_errors_import_idx ON "CsvImportError"("importId", "rowNumber");

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON notifications(user_id, created_at DESC);

CREATE TABLE cms_landing_sections (
  id text PRIMARY KEY, section_key text NOT NULL UNIQUE, name text NOT NULL,
  title text NOT NULL, subtitle text, sort_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT false, content_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_testimonials (
  id text PRIMARY KEY, artist_name text NOT NULL, avatar_url text, role_label text,
  quote text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_faq_categories (
  id text PRIMARY KEY, name text NOT NULL, slug text UNIQUE, description text,
  sort_order integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_faq_items (
  id text PRIMARY KEY, category_id text NOT NULL REFERENCES cms_faq_categories(id) ON DELETE CASCADE,
  question text NOT NULL, answer text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_scrollytelling (
  id text PRIMARY KEY, is_enabled boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'draft',
  bg_color text NOT NULL DEFAULT '#000000', scroll_height_vh integer NOT NULL DEFAULT 300,
  canvas_aspect_ratio text NOT NULL DEFAULT '16:9', cta_label text NOT NULL DEFAULT '',
  cta_url text NOT NULL DEFAULT '', text_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_scrollytelling_frames (
  id text PRIMARY KEY, scrollytelling_id text NOT NULL REFERENCES cms_scrollytelling(id) ON DELETE CASCADE,
  frame_index integer NOT NULL, frame_url text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scrollytelling_id, frame_index)
);

CREATE TABLE temp_upload_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), upload_id text NOT NULL,
  chunk_index integer NOT NULL, data text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(upload_id, chunk_index)
);
