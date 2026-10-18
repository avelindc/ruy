# Breakout Music Worker integration notes

## Migration 0003

`migrations/0003_release_streaming_finance.sql` is additive and must run after `0001_initial` and `0002_user_artist_id`. It adds release/track metadata, import period and row identity fields, royalty rules and calculation batches, and the financial ledger. It also backfills existing royalties and withdrawals with idempotent opening ledger entries. It does not delete or reset application data.

This migration has **not** been applied by this work. Run `npm run migrate` from `workers/` only with a verified isolated Neon staging URL in the ignored local `workers/.dev.vars`. The script prints the Neon host, refuses to infer migration state for a non-empty database without migration history, verifies checksums, and requires the exact interactive phrase `APPLY BREAKOUT MUSIC MIGRATIONS`. Do not point it at production for this local verification.

## Runtime configuration

The Worker source expects `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT`, and `CORS_ALLOWED_ORIGINS` from runtime configuration. No values belong in this file or Git. The current `wrangler.toml` has the production CORS origin but no R2 bucket binding.

Without an R2 bucket bound as `STORAGE_BUCKET`, file uploads use Neon chunk storage only for files up to 8 MiB; larger uploads return HTTP 503. The R2 upload path streams file contents after checking the file signature. R2 availability has not been verified against production.

## Streaming report format and processing

The current CSV path supports column mapping in the admin UI. Required mapped row values are a 12-character ISRC, platform, two-letter territory, ISO date, non-negative integer stream count, and a valid currency code; UPC is optional but must match the registered release when supplied. The UI limits source files to 10 MiB; the Worker limits each JSON row request to 15 MiB and 5,000 rows/errors. The original source file is not retained; filename, SHA-256, report period, accepted streaming rows, and row errors are persisted.

The Worker recomputes hashes and matches ISRC/UPC to registered tracks/releases. Re-imported track/platform/territory/date identities are blocked, including revenue corrections, because an audited correction/reversal workflow is not yet implemented. Reports with validation or matching errors remain `partial` and cannot be processed for royalties. Manual streaming entry is not available yet.

Royalty processing currently supports USD reports only. An admin must configure a non-overlapping share rule for each artist/platform/effective date. There is no default revenue share, FX conversion, or automatic distributor integration. `APPROVED` is an internal review status and does not mean a release was delivered to a distributor or is live.

## Verification boundary

Local Worker tests exercise handlers and adapter SQL construction with synthetic fixtures. They do not execute migration SQL against PostgreSQL or exercise a staging/production database. Apply the migration to an isolated staging Neon branch and run database-backed integration checks before deploying this Worker or the frontend changes.
