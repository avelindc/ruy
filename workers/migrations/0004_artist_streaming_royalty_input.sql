-- Additive tables for admin-entered artist-level streaming and royalty records.
-- Track-level Streaming and existing royalty/report tables remain unchanged.

CREATE TABLE IF NOT EXISTS public."ArtistStreamingAggregate" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artistId" uuid NOT NULL REFERENCES public."Artist"(id) ON DELETE RESTRICT,
  platform text NOT NULL CHECK (length(btrim(platform)) BETWEEN 1 AND 80),
  "periodStart" date NOT NULL,
  "periodEnd" date NOT NULL,
  streams bigint NOT NULL CHECK (streams >= 0),
  territory text,
  "grossRevenue" numeric(16,2) CHECK ("grossRevenue" IS NULL OR "grossRevenue" >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  "reportIdentifier" text,
  notes text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "createdBy" uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "updatedBy" uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("periodEnd" >= "periodStart"),
  CHECK ("grossRevenue" IS NULL OR currency IS NOT NULL)
);

-- A report reference allows distinct source statements for the same period;
-- without a reference, only one manual aggregate per artist/platform/period/territory is accepted.
CREATE UNIQUE INDEX IF NOT EXISTS artist_streaming_aggregate_natural_unique_idx
  ON public."ArtistStreamingAggregate" (
    "artistId", platform, "periodStart", "periodEnd", COALESCE(territory, '')
  ) WHERE "reportIdentifier" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS artist_streaming_aggregate_report_unique_idx
  ON public."ArtistStreamingAggregate" (
    "artistId", platform, "periodStart", "periodEnd", COALESCE(territory, ''), "reportIdentifier"
  ) WHERE "reportIdentifier" IS NOT NULL;
CREATE INDEX IF NOT EXISTS artist_streaming_aggregate_artist_period_idx
  ON public."ArtistStreamingAggregate" ("artistId", "periodStart" DESC, platform);

CREATE TABLE IF NOT EXISTS public."ManualArtistRoyalty" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artistId" uuid NOT NULL REFERENCES public."Artist"(id) ON DELETE RESTRICT,
  "periodStart" date NOT NULL,
  "periodEnd" date NOT NULL,
  streams bigint CHECK (streams IS NULL OR streams >= 0),
  "grossRevenue" numeric(16,2) CHECK ("grossRevenue" IS NULL OR "grossRevenue" >= 0),
  deductions numeric(16,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  "netRoyalty" numeric(16,2) NOT NULL CHECK ("netRoyalty" >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('draft', 'finalized', 'superseded')),
  "reportIdentifier" text,
  notes text,
  "supersedesId" uuid REFERENCES public."ManualArtistRoyalty"(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  "createdBy" uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("periodEnd" >= "periodStart"),
  CHECK ("grossRevenue" IS NULL OR deductions <= "grossRevenue")
);

-- Root entries are idempotent by artist, period, currency and optional report identity.
CREATE UNIQUE INDEX IF NOT EXISTS manual_artist_royalty_root_unique_idx
  ON public."ManualArtistRoyalty" (
    "artistId", "periodStart", "periodEnd", currency, COALESCE("reportIdentifier", '')
  ) WHERE "supersedesId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS manual_artist_royalty_single_correction_idx
  ON public."ManualArtistRoyalty" ("supersedesId") WHERE "supersedesId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS manual_artist_royalty_artist_period_idx
  ON public."ManualArtistRoyalty" ("artistId", "periodStart" DESC, status);

