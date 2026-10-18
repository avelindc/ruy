-- Additive metadata and finance schema. Existing submissions and records remain intact.

ALTER TABLE public."Release"
  ADD COLUMN IF NOT EXISTS "releaseVersion" text,
  ADD COLUMN IF NOT EXISTS subgenre text,
  ADD COLUMN IF NOT EXISTS "originalReleaseDate" date,
  ADD COLUMN IF NOT EXISTS "selfReleased" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "copyrightC" text,
  ADD COLUMN IF NOT EXISTS "copyrightP" text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS "distributionRightsConfirmed" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public."ReleaseContributor" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "releaseId" uuid NOT NULL REFERENCES public."Release"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = 'featured_artist'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("releaseId", role, position)
);

ALTER TABLE public."Track"
  ADD COLUMN IF NOT EXISTS "trackVersion" text,
  ADD COLUMN IF NOT EXISTS "primaryArtist" text,
  ADD COLUMN IF NOT EXISTS "trackNumber" integer CHECK ("trackNumber" IS NULL OR "trackNumber" > 0),
  ADD COLUMN IF NOT EXISTS "discNumber" integer NOT NULL DEFAULT 1 CHECK ("discNumber" > 0),
  ADD COLUMN IF NOT EXISTS "rightsOwnership" text,
  ADD COLUMN IF NOT EXISTS "distributionRightsConfirmed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "genre" text,
  ADD COLUMN IF NOT EXISTS "composerNames" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "songwriterNames" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "producerNames" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "arrangerNames" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "featuredArtists" text[] NOT NULL DEFAULT '{}';

ALTER TABLE public."CsvImport"
  ADD COLUMN IF NOT EXISTS "reportIdentifier" text,
  ADD COLUMN IF NOT EXISTS "periodStart" date,
  ADD COLUMN IF NOT EXISTS "periodEnd" date,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS "finalizedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "finalizedBy" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "correctionOf" uuid REFERENCES public."CsvImport"(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "revisionNumber" integer NOT NULL DEFAULT 1 CHECK ("revisionNumber" > 0);

ALTER TABLE public."Streaming"
  ADD COLUMN IF NOT EXISTS "grossRevenue" numeric(16,6),
  ADD COLUMN IF NOT EXISTS deductions numeric(16,6),
  ADD COLUMN IF NOT EXISTS "netRevenue" numeric(16,6),
  ADD COLUMN IF NOT EXISTS "sourceRowReference" text,
  ADD COLUMN IF NOT EXISTS "periodStart" date,
  ADD COLUMN IF NOT EXISTS "periodEnd" date;
CREATE UNIQUE INDEX IF NOT EXISTS streaming_source_identity_unique_idx
  ON public."Streaming"("sourceRowReference")
  WHERE "sourceRowReference" IS NOT NULL;

-- Explicit, admin-configured share rules; no default rate is inserted.
CREATE TABLE IF NOT EXISTS public."RoyaltyRule" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artistId" uuid NOT NULL REFERENCES public."Artist"(id) ON DELETE RESTRICT,
  platform text NOT NULL,
  "sharePercent" numeric(7,4) NOT NULL CHECK ("sharePercent" > 0 AND "sharePercent" <= 100),
  "revenueBasis" text NOT NULL CHECK ("revenueBasis" IN ('gross', 'net')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  "effectiveFrom" date NOT NULL,
  "effectiveUntil" date,
  "createdBy" uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" >= "effectiveFrom")
);
CREATE INDEX IF NOT EXISTS royalty_rule_lookup_idx
  ON public."RoyaltyRule"("artistId", platform, "effectiveFrom", "effectiveUntil");

CREATE TABLE IF NOT EXISTS public."RoyaltyCalculationBatch" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reportId" uuid NOT NULL UNIQUE REFERENCES public."CsvImport"(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed', 'reversed')),
  "ruleSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdBy" uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz
);

ALTER TABLE public."Royalty"
  ADD COLUMN IF NOT EXISTS "trackId" uuid REFERENCES public."Track"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "releaseId" uuid REFERENCES public."Release"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "reportId" uuid REFERENCES public."CsvImport"(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "batchId" uuid REFERENCES public."RoyaltyCalculationBatch"(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "grossRevenue" numeric(16,6),
  ADD COLUMN IF NOT EXISTS deductions numeric(16,6),
  ADD COLUMN IF NOT EXISTS "netRevenue" numeric(16,6),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
CREATE UNIQUE INDEX IF NOT EXISTS royalty_batch_track_period_idx
  ON public."Royalty"("batchId", "trackId", month, year, currency)
  WHERE "batchId" IS NOT NULL AND "trackId" IS NOT NULL;

-- Append-only financial history. Amounts use signed numeric values in a single currency.
CREATE TABLE IF NOT EXISTS public."FinancialLedgerEntry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  "artistId" uuid REFERENCES public."Artist"(id) ON DELETE RESTRICT,
  "entryType" text NOT NULL CHECK ("entryType" IN (
    'royalty_credit', 'adjustment_credit', 'withdrawal_reserve',
    'withdrawal_release', 'withdrawal_debit'
  )),
  amount numeric(16,2) NOT NULL CHECK (amount <> 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  "referenceType" text NOT NULL,
  "referenceId" uuid NOT NULL,
  "idempotencyKey" text NOT NULL UNIQUE,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdBy" uuid REFERENCES public.users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_ledger_user_created_idx
  ON public."FinancialLedgerEntry"("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS public."RoyaltyCalculationItem" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchId" uuid NOT NULL REFERENCES public."RoyaltyCalculationBatch"(id) ON DELETE RESTRICT,
  "trackId" uuid NOT NULL REFERENCES public."Track"(id) ON DELETE RESTRICT,
  "releaseId" uuid NOT NULL REFERENCES public."Release"(id) ON DELETE RESTRICT,
  "artistId" uuid NOT NULL REFERENCES public."Artist"(id) ON DELETE RESTRICT,
  "ruleId" uuid NOT NULL REFERENCES public."RoyaltyRule"(id) ON DELETE RESTRICT,
  platform text NOT NULL,
  "periodStart" date NOT NULL,
  streams bigint NOT NULL CHECK (streams >= 0),
  "grossRevenue" numeric(16,6) NOT NULL CHECK ("grossRevenue" >= 0),
  deductions numeric(16,6) NOT NULL CHECK (deductions >= 0),
  "netRevenue" numeric(16,6) NOT NULL CHECK ("netRevenue" >= 0),
  "sharePercent" numeric(7,4) NOT NULL CHECK ("sharePercent" > 0 AND "sharePercent" <= 100),
  "royaltyAmount" numeric(16,2) NOT NULL CHECK ("royaltyAmount" >= 0),
  currency text NOT NULL CHECK (currency = 'USD'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("batchId", "trackId", platform, "periodStart", currency, "ruleId")
);

CREATE INDEX IF NOT EXISTS royalty_calc_artist_period_idx
  ON public."RoyaltyCalculationItem"("artistId", "periodStart" DESC);

-- Backfill a read-only starting balance into the append-only ledger; repeated runs are idempotent.
INSERT INTO public."FinancialLedgerEntry" (
  "userId", "artistId", "entryType", amount, currency, "referenceType", "referenceId",
  "idempotencyKey", description, "createdBy", "createdAt"
)
SELECT a."userId", r."artistId", 'royalty_credit', round(r."totalRevenue", 2), COALESCE(r.currency, 'USD'),
       'legacy_royalty', r.id, 'legacy-royalty:' || r.id::text, 'Opening balance from finalized royalty record', NULL, now()
FROM public."Royalty" r
JOIN public."Artist" a ON a.id = r."artistId"
WHERE round(r."totalRevenue", 2) <> 0
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO public."FinancialLedgerEntry" (
  "userId", "entryType", amount, currency, "referenceType", "referenceId", "idempotencyKey",
  description, "createdBy", "createdAt"
)
SELECT w."userId",
       CASE WHEN lower(w.status) = 'paid' THEN 'withdrawal_debit' ELSE 'withdrawal_reserve' END,
       -round(w.amount, 2), w.currency, 'withdrawal', w.id,
       'legacy-withdrawal:' || w.id::text || ':' || CASE WHEN lower(w.status) = 'paid' THEN 'debit' ELSE 'reserve' END,
       'Opening balance from existing withdrawal', w."reviewedBy", w."createdAt"
FROM public."Withdrawal" w
WHERE lower(w.status) IN ('pending', 'under_review', 'approved', 'processing', 'paid')
ON CONFLICT ("idempotencyKey") DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_royalty_rule(
  p_artist_id uuid, p_platform text, p_share_percent numeric, p_revenue_basis text,
  p_currency text, p_effective_from date, p_effective_until date, p_created_by uuid
) RETURNS public."RoyaltyRule" LANGUAGE plpgsql AS $$
DECLARE
  v_rule public."RoyaltyRule"%ROWTYPE;
  v_platform text := lower(btrim(p_platform));
  v_currency text := upper(btrim(p_currency));
BEGIN
  IF v_platform = '' OR length(v_platform) > 80 THEN RAISE EXCEPTION 'Invalid royalty platform.'; END IF;
  IF p_share_percent <= 0 OR p_share_percent > 100 THEN RAISE EXCEPTION 'Royalty share must be greater than 0 and at most 100 percent.'; END IF;
  IF p_revenue_basis NOT IN ('gross', 'net') THEN RAISE EXCEPTION 'Revenue basis must be gross or net.'; END IF;
  IF v_currency <> 'USD' THEN RAISE EXCEPTION 'Royalty processing currently supports USD reports only; no FX conversion is configured.'; END IF;
  IF p_effective_until IS NOT NULL AND p_effective_until < p_effective_from THEN RAISE EXCEPTION 'Invalid royalty rule date range.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_artist_id::text || ':' || v_platform || ':' || v_currency, 0));
  IF EXISTS (
    SELECT 1 FROM public."RoyaltyRule" r
    WHERE r."artistId" = p_artist_id AND lower(r.platform) = v_platform AND r.currency = v_currency
      AND daterange(r."effectiveFrom", COALESCE(r."effectiveUntil" + 1, 'infinity'::date), '[)')
          && daterange(p_effective_from, COALESCE(p_effective_until + 1, 'infinity'::date), '[)')
  ) THEN
    RAISE EXCEPTION 'Royalty rule overlaps an existing effective date range.';
  END IF;

  INSERT INTO public."RoyaltyRule" ("artistId", platform, "sharePercent", "revenueBasis", currency,
    "effectiveFrom", "effectiveUntil", "createdBy")
  VALUES (p_artist_id, v_platform, p_share_percent, p_revenue_basis, v_currency,
    p_effective_from, p_effective_until, p_created_by)
  RETURNING * INTO v_rule;

  INSERT INTO public."AuditLog" ("actorId", action, "entityType", "entityId", metadata)
  VALUES (p_created_by, 'royalty.rule_created', 'RoyaltyRule', v_rule.id,
    jsonb_build_object('artistId', p_artist_id, 'platform', v_platform,
      'sharePercent', p_share_percent, 'revenueBasis', p_revenue_basis, 'currency', v_currency));
  RETURN v_rule;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_streaming_report_royalties(
  p_report_id uuid, p_admin_id uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_report public."CsvImport"%ROWTYPE;
  v_batch_id uuid;
  v_existing_status text;
  v_bad_rows bigint;
BEGIN
  SELECT * INTO v_report FROM public."CsvImport" WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CSV report not found.'; END IF;
  IF v_report.status <> 'completed' THEN RAISE EXCEPTION 'CSV report must finish validation before royalty processing.'; END IF;
  IF v_report."invalidRows" <> 0 THEN RAISE EXCEPTION 'CSV report contains invalid, duplicate, or unmatched rows; resolve them before processing royalties.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public."Streaming" WHERE "reportId" = p_report_id) THEN RAISE EXCEPTION 'CSV report has no eligible streaming records.'; END IF;

  SELECT id, status INTO v_batch_id, v_existing_status
  FROM public."RoyaltyCalculationBatch" WHERE "reportId" = p_report_id;
  IF FOUND THEN
    IF v_existing_status = 'completed' THEN RETURN v_batch_id; END IF;
    RAISE EXCEPTION 'A royalty batch already exists for this report and requires administrator review.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."Streaming" s
    JOIN public."Track" t ON t.id = s."trackId"
    WHERE s."reportId" = p_report_id AND s.currency <> 'USD'
  ) THEN
    RAISE EXCEPTION 'This royalty pipeline supports USD reports only; it does not perform currency conversion.';
  END IF;

  SELECT count(*) INTO v_bad_rows
  FROM public."Streaming" s
  LEFT JOIN public."Track" t ON t.id = s."trackId"
  LEFT JOIN public."Release" r ON r.id = t."releaseId" AND r.id = s."releaseId"
  LEFT JOIN public."Artist" a ON a.id = r."artistId"
  WHERE s."reportId" = p_report_id AND (t.id IS NULL OR r.id IS NULL OR a.id IS NULL);
  IF v_bad_rows > 0 THEN RAISE EXCEPTION 'Report contains streaming rows without a verified track, release, and artist relationship.'; END IF;

  SELECT count(*) INTO v_bad_rows FROM (
    SELECT s.id
    FROM public."Streaming" s
    JOIN public."Track" t ON t.id = s."trackId"
    JOIN public."Release" r ON r.id = t."releaseId" AND r.id = s."releaseId"
    LEFT JOIN public."RoyaltyRule" rr ON rr."artistId" = r."artistId"
      AND lower(rr.platform) = lower(s.platform) AND rr.currency = s.currency
      AND rr."effectiveFrom" <= s.date AND (rr."effectiveUntil" IS NULL OR rr."effectiveUntil" >= s.date)
    WHERE s."reportId" = p_report_id
    GROUP BY s.id HAVING count(rr.id) <> 1
  ) missing_or_ambiguous;
  IF v_bad_rows > 0 THEN RAISE EXCEPTION 'Every report row must match exactly one active artist/platform/currency royalty rule.'; END IF;

  INSERT INTO public."RoyaltyCalculationBatch" ("reportId", status, "createdBy")
  VALUES (p_report_id, 'processing', p_admin_id) RETURNING id INTO v_batch_id;

  INSERT INTO public."RoyaltyCalculationItem" (
    "batchId", "trackId", "releaseId", "artistId", "ruleId", platform, "periodStart", streams,
    "grossRevenue", deductions, "netRevenue", "sharePercent", "royaltyAmount", currency
  )
  SELECT v_batch_id, t.id, r.id, r."artistId", rr.id, lower(s.platform), date_trunc('month', s.date)::date,
    sum(s."playCount"), sum(COALESCE(s."grossRevenue", s.revenue, 0)), sum(COALESCE(s.deductions, 0)),
    sum(COALESCE(s."netRevenue", COALESCE(s.revenue, 0) - COALESCE(s.deductions, 0))),
    rr."sharePercent",
    round(sum((CASE rr."revenueBasis" WHEN 'gross' THEN COALESCE(s."grossRevenue", s.revenue, 0)
      ELSE COALESCE(s."netRevenue", COALESCE(s.revenue, 0) - COALESCE(s.deductions, 0)) END) * rr."sharePercent" / 100), 2),
    s.currency
  FROM public."Streaming" s
  JOIN public."Track" t ON t.id = s."trackId"
  JOIN public."Release" r ON r.id = t."releaseId" AND r.id = s."releaseId"
  JOIN public."RoyaltyRule" rr ON rr."artistId" = r."artistId" AND lower(rr.platform) = lower(s.platform)
    AND rr.currency = s.currency AND rr."effectiveFrom" <= s.date
    AND (rr."effectiveUntil" IS NULL OR rr."effectiveUntil" >= s.date)
  WHERE s."reportId" = p_report_id
  GROUP BY t.id, r.id, r."artistId", rr.id, lower(s.platform), date_trunc('month', s.date)::date, rr."sharePercent", s.currency;

  IF NOT EXISTS (SELECT 1 FROM public."RoyaltyCalculationItem" WHERE "batchId" = v_batch_id) THEN
    RAISE EXCEPTION 'No royalty calculation rows were produced.';
  END IF;

  INSERT INTO public."Royalty" (
    "artistId", "songName", month, year, "spotifyStreams", "appleMusicStreams", "youtubeStreams",
    "tiktokStreams", "amazonStreams", "otherStreams", "platformData", "totalRevenue", currency, "createdAt", "updatedAt"
  )
  SELECT i."artistId", t.title, extract(month FROM i."periodStart")::smallint, extract(year FROM i."periodStart")::smallint,
    sum(CASE WHEN i.platform = 'spotify' THEN i.streams ELSE 0 END),
    sum(CASE WHEN i.platform IN ('apple_music', 'apple music', 'applemusic') THEN i.streams ELSE 0 END),
    sum(CASE WHEN i.platform IN ('youtube', 'youtube_music', 'youtube music') THEN i.streams ELSE 0 END),
    sum(CASE WHEN i.platform = 'tiktok' THEN i.streams ELSE 0 END),
    sum(CASE WHEN i.platform IN ('amazon_music', 'amazon music', 'amazonmusic') THEN i.streams ELSE 0 END),
    sum(CASE WHEN i.platform NOT IN ('spotify', 'apple_music', 'apple music', 'applemusic', 'youtube', 'youtube_music', 'youtube music', 'tiktok', 'amazon_music', 'amazon music', 'amazonmusic') THEN i.streams ELSE 0 END),
    '{}'::jsonb, sum(i."royaltyAmount"), 'USD', now(), now()
  FROM public."RoyaltyCalculationItem" i
  JOIN public."Track" t ON t.id = i."trackId"
  WHERE i."batchId" = v_batch_id
  GROUP BY i."artistId", t.title, extract(month FROM i."periodStart"), extract(year FROM i."periodStart")
  ON CONFLICT ("artistId", "songName", month, year) DO UPDATE SET
    "spotifyStreams" = public."Royalty"."spotifyStreams" + EXCLUDED."spotifyStreams",
    "appleMusicStreams" = public."Royalty"."appleMusicStreams" + EXCLUDED."appleMusicStreams",
    "youtubeStreams" = public."Royalty"."youtubeStreams" + EXCLUDED."youtubeStreams",
    "tiktokStreams" = public."Royalty"."tiktokStreams" + EXCLUDED."tiktokStreams",
    "amazonStreams" = public."Royalty"."amazonStreams" + EXCLUDED."amazonStreams",
    "otherStreams" = public."Royalty"."otherStreams" + EXCLUDED."otherStreams",
    "totalRevenue" = public."Royalty"."totalRevenue" + EXCLUDED."totalRevenue",
    "updatedAt" = now();

  INSERT INTO public."FinancialLedgerEntry" (
    "userId", "artistId", "entryType", amount, currency, "referenceType", "referenceId", "idempotencyKey",
    description, metadata, "createdBy"
  )
  SELECT a."userId", i."artistId", 'royalty_credit', i."royaltyAmount", i.currency, 'royalty_calculation_item', i.id,
    'royalty-item:' || i.id::text, 'Royalty credit from finalized streaming report',
    jsonb_build_object('batchId', v_batch_id, 'trackId', i."trackId", 'periodStart', i."periodStart", 'platform', i.platform), p_admin_id
  FROM public."RoyaltyCalculationItem" i
  JOIN public."Artist" a ON a.id = i."artistId"
  WHERE i."batchId" = v_batch_id AND i."royaltyAmount" > 0
  ON CONFLICT ("idempotencyKey") DO NOTHING;

  UPDATE public."RoyaltyCalculationBatch" b
  SET status = 'completed', "completedAt" = now(), "ruleSnapshot" = COALESCE((
    SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'ruleId', i."ruleId", 'artistId', i."artistId", 'platform', i.platform,
      'sharePercent', i."sharePercent", 'currency', i.currency
    ))
    FROM public."RoyaltyCalculationItem" i WHERE i."batchId" = v_batch_id
  ), '[]'::jsonb)
  WHERE b.id = v_batch_id;
  UPDATE public."CsvImport" SET "finalizedAt" = now(), "finalizedBy" = p_admin_id WHERE id = p_report_id;
  INSERT INTO public."AuditLog" ("actorId", action, "entityType", "entityId", metadata)
  VALUES (p_admin_id, 'royalties.processed', 'CsvImport', p_report_id,
    jsonb_build_object('batchId', v_batch_id, 'items', (SELECT count(*) FROM public."RoyaltyCalculationItem" WHERE "batchId" = v_batch_id)));
  RETURN v_batch_id;
END;
$$;

\n