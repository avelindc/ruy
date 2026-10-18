import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { NeonAdapter } from '../dist/adapters/neonAdapter.js';
import { handleAdminArtistFinance, handleArtistStreamingAggregates } from '../dist/handlers/artistFinanceHandler.js';
import { handleRoyalties } from '../dist/index.js';

const secret = 'worker-artist-finance-test-secret';
const adminId = '11111111-1111-4111-8111-111111111111';
const artistOwnerId = '22222222-2222-4222-8222-222222222222';
const otherOwnerId = '33333333-3333-4333-8333-333333333333';
const artistId = '44444444-4444-4444-8444-444444444444';
const otherArtistId = '55555555-5555-4555-8555-555555555555';

function jwt(userId, role = 'user') {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const message = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId,
    email: `${role}@example.test`,
    user_role: role,
    jti: userId,
    iat: now,
    exp: now + 3600,
    aud: 'breakout-music',
    iss: 'breakout-music-api',
  })}`;
  return `${message}.${createHmac('sha256', secret).update(message).digest('base64url')}`;
}

function request(path, method, token, body) {
  return new Request(`https://api.example.test${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function baseSessionAdapter(currentUser = { id: adminId, role: 'admin' }) {
  return {
    async getUser(id) {
      if (id === currentUser.id) {
        return { id, email: `${currentUser.role}@example.test`, role: currentUser.role, account_status: 'active' };
      }
      return { id, email: `${id}@example.test`, role: 'user', account_status: 'active' };
    },
    async isAuthSessionValid(id, jti) {
      return id === jti;
    },
  };
}

// 1. Dropdown menampilkan artis yang memiliki rilisan
test('1. Dropdown query filters artists with at least one catalog release', async () => {
  let executedSql = '';
  const adapter = new NeonAdapter({
    async query(sql) {
      executedSql = sql;
      return {
        rows: [
          {
            id: artistId,
            artist_name: 'Luna Eclipse',
            owner_id: artistOwnerId,
            owner_email: 'luna@example.test',
            account_artist_id: '10000000000001',
          },
        ],
      };
    },
  });

  const artists = await adapter.listArtistFinanceArtists();
  assert.equal(artists.length, 1);
  assert.equal(artists[0].artist_name, 'Luna Eclipse');
  assert.equal(artists[0].id, artistId);
  assert.match(executedSql, /EXISTS\s*\(\s*SELECT 1 FROM public\."Release" r WHERE r\."artistId" = a\.id\s*\)/i);
});

// 2. Artis yang mempunyai banyak rilisan tidak muncul berulang kali
test('2. Artists with multiple releases are deduplicated with SELECT DISTINCT', async () => {
  let executedSql = '';
  const adapter = new NeonAdapter({
    async query(sql) {
      executedSql = sql;
      return {
        rows: [
          { id: artistId, artist_name: 'Luna Eclipse', owner_id: artistOwnerId, owner_email: 'luna@example.test' },
        ],
      };
    },
  });

  await adapter.listArtistFinanceArtists();
  assert.match(executedSql, /SELECT DISTINCT a\.id/i);
});

// 3. Input streaming tersimpan ke database
test('3. Streaming input saves to database and writes audit log', async () => {
  let executedSql = '';
  let queryParams = [];
  const adapter = new NeonAdapter({
    async query(sql, params) {
      executedSql = sql;
      queryParams = params;
      return {
        rows: [
          {
            id: 'stream-row-1',
            artistId,
            artistName: 'Luna Eclipse',
            ownerId: artistOwnerId,
            ownerEmail: 'luna@example.test',
            platform: 'Spotify',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            streams: '45000',
            territory: 'ID',
            grossRevenue: '135.50',
            currency: 'USD',
            reportIdentifier: 'SPOT-2026-08-LUNA',
            notes: 'Verified via Spotify for Artists statement',
            source: 'manual',
            version: 1,
            createdBy: adminId,
            createdAt: '2026-08-31T12:00:00Z',
            updatedAt: '2026-08-31T12:00:00Z',
          },
        ],
      };
    },
  });

  const result = await adapter.createArtistStreamingAggregate({
    artist_id: artistId,
    platform: 'Spotify',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    streams: 45000,
    territory: 'ID',
    gross_revenue: '135.50',
    currency: 'USD',
    report_identifier: 'SPOT-2026-08-LUNA',
    notes: 'Verified via Spotify for Artists statement',
  }, adminId);

  assert.equal(result.id, 'stream-row-1');
  assert.equal(result.streams, 45000);
  assert.equal(result.currency, 'USD');
  assert.match(executedSql, /INSERT INTO public\."ArtistStreamingAggregate"/);
  assert.match(executedSql, /INSERT INTO public\."AuditLog"/);
  assert.equal(queryParams[0], artistId);
  assert.equal(queryParams[1], 'Spotify');
  assert.equal(queryParams[4], 45000);
});

// 4. Input royalti tersimpan ke database
test('4. Royalty input saves to database and creates ledger entry when finalized', async () => {
  let executedSql = '';
  const adapter = new NeonAdapter({
    async query(sql) {
      executedSql = sql;
      return {
        rows: [
          {
            id: 'royalty-row-1',
            artistId,
            artistName: 'Luna Eclipse',
            ownerId: artistOwnerId,
            ownerEmail: 'luna@example.test',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            streams: '45000',
            grossRevenue: '135.50',
            deductions: '15.50',
            netRoyalty: '120.00',
            currency: 'USD',
            status: 'finalized',
            reportIdentifier: 'ROY-2026-08-LUNA',
            revision: 1,
            createdBy: adminId,
            createdAt: '2026-08-31T12:00:00Z',
          },
        ],
      };
    },
  });

  const result = await adapter.createManualArtistRoyalty({
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    streams: 45000,
    gross_revenue: '135.50',
    deductions: '15.50',
    net_royalty: '120.00',
    currency: 'USD',
    status: 'finalized',
    report_identifier: 'ROY-2026-08-LUNA',
  }, adminId);

  assert.equal(result.id, 'royalty-row-1');
  assert.equal(result.net_royalty, '120.00');
  assert.equal(result.status, 'finalized');
  assert.match(executedSql, /INSERT INTO public\."ManualArtistRoyalty"/);
  assert.match(executedSql, /INSERT INTO public\."FinancialLedgerEntry"/);
  assert.match(executedSql, /'manual-artist-royalty:' \|\| i\.id::text/);
});

// 5. Data tetap ada setelah halaman dimuat ulang
test('5. Data persists and is read correctly from database across refreshes', async () => {
  const adapter = new NeonAdapter({
    async query(sql) {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
      return {
        rows: [
          {
            id: 'royalty-row-1',
            artistId,
            artistName: 'Luna Eclipse',
            ownerId: artistOwnerId,
            ownerEmail: 'luna@example.test',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            streams: '45000',
            grossRevenue: '135.50',
            deductions: '15.50',
            netRoyalty: '120.00',
            currency: 'USD',
            status: 'finalized',
            revision: 1,
            createdBy: adminId,
            createdAt: '2026-08-31T12:00:00Z',
          },
        ],
      };
    },
  });

  const royalties = await adapter.listManualArtistRoyalties({ artist_id: artistId });
  assert.equal(royalties.total, 1);
  assert.equal(royalties.data[0].id, 'royalty-row-1');
  assert.equal(royalties.data[0].period_start, '2026-08-01');
  assert.equal(royalties.data[0].net_royalty, '120.00');
});

// 6. Data muncul di akun artis yang benar
test('6. Artist endpoint filters aggregates and royalties to the authenticated account', async () => {
  let filterOwnerId = '';
  const adapter = {
    ...baseSessionAdapter({ id: artistOwnerId, role: 'user' }),
    async listArtistStreamingAggregates(filters) {
      filterOwnerId = filters.owner_id;
      return {
        data: [
          {
            id: 'stream-row-1',
            artist_id: artistId,
            artist_name: 'Luna Eclipse',
            owner_id: artistOwnerId,
            platform: 'Spotify',
            period_start: '2026-08-01',
            period_end: '2026-08-31',
            streams: 45000,
            gross_revenue: '135.50',
            currency: 'USD',
            source: 'manual',
            version: 1,
            created_by: adminId,
            created_at: '2026-08-31T12:00:00Z',
            updated_at: '2026-08-31T12:00:00Z',
          },
        ],
        total: 1,
      };
    },
    async getArtist(id) {
      if (id === artistId) return { id, owner_id: artistOwnerId, stage_name: 'Luna Eclipse' };
      return null;
    },
  };

  const response = await handleArtistStreamingAggregates(
    request('/api/streaming/aggregates', 'GET', jwt(artistOwnerId, 'user')),
    { JWT_SECRET: secret },
    adapter,
    {},
  );

  assert.equal(response.status, 200);
  assert.equal(filterOwnerId, artistOwnerId);
  const json = await response.json();
  assert.equal(json.data.data.length, 1);
  assert.equal(json.data.data[0].artist_name, 'Luna Eclipse');
});

// 7. Akun artis tidak dapat melihat data artis lain
test('7. Artist cannot query another account’s artist streaming data', async () => {
  const adapter = {
    ...baseSessionAdapter({ id: artistOwnerId, role: 'user' }),
    async getArtist(id) {
      if (id === otherArtistId) return { id, owner_id: otherOwnerId, stage_name: 'Other Artist' };
      return null;
    },
    async listArtistStreamingAggregates() {
      return { data: [], total: 0 };
    },
  };

  const response = await handleArtistStreamingAggregates(
    request(`/api/streaming/aggregates?artist_id=${otherArtistId}`, 'GET', jwt(artistOwnerId, 'user')),
    { JWT_SECRET: secret },
    adapter,
    {},
  );

  assert.equal(response.status, 401);
  const json = await response.json();
  assert.match(json.error, /does not belong to the signed-in account/i);
});

// 8. Endpoint menolak input dari non-admin
test('8. Admin artist finance endpoints reject non-admin users with 403', async () => {
  const adapter = {
    ...baseSessionAdapter({ id: artistOwnerId, role: 'user' }),
  };

  const response = await handleAdminArtistFinance(
    request('/api/admin/artist-finance/streaming', 'POST', jwt(artistOwnerId, 'user'), {
      artist_id: artistId,
      platform: 'Spotify',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      streams: 1000,
    }),
    { JWT_SECRET: secret },
    adapter,
    {},
  );

  assert.equal(response.status, 403);
});

// 9. Duplikasi laporan dicegah
test('9. Duplicate streaming and royalty reports trigger unique conflict validation', async () => {
  const duplicateError = new Error('duplicate key value violates unique constraint');
  duplicateError.code = '23505';

  const adapter = {
    ...baseSessionAdapter({ id: adminId, role: 'admin' }),
    async createArtistStreamingAggregate() {
      throw duplicateError;
    },
  };

  const response = await handleAdminArtistFinance(
    request('/api/admin/artist-finance/streaming', 'POST', jwt(adminId, 'admin'), {
      artist_id: artistId,
      platform: 'Spotify',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      streams: 5000,
    }),
    { JWT_SECRET: secret },
    adapter,
    {},
  );

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.match(json.error, /already exists/i);
});

// 10. Nilai negatif dan currency yang tidak valid ditolak
test('10. Negative values and invalid currency codes are rejected', async () => {
  const adapter = {
    ...baseSessionAdapter({ id: adminId, role: 'admin' }),
  };

  // Test negative stream count
  const negativeStreams = await handleAdminArtistFinance(
    request('/api/admin/artist-finance/streaming', 'POST', jwt(adminId, 'admin'), {
      artist_id: artistId,
      platform: 'Spotify',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      streams: -500,
    }),
    { JWT_SECRET: secret },
    adapter,
    {},
  );
  assert.equal(negativeStreams.status, 400);

  // Test invalid currency code
  const invalidCurrency = await handleAdminArtistFinance(
    request('/api/admin/artist-finance/streaming', 'POST', jwt(adminId, 'admin'), {
      artist_id: artistId,
      platform: 'Spotify',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      streams: 500,
      gross_revenue: '100.00',
      currency: 'INVALID_CURRENCY',
    }),
    { JWT_SECRET: secret },
    adapter,
    {},
  );
  assert.equal(invalidCurrency.status, 400);

  // Test deductions greater than gross revenue
  const excessiveDeductions = await handleAdminArtistFinance(
    request('/api/admin/artist-finance/royalties', 'POST', jwt(adminId, 'admin'), {
      artist_id: artistId,
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      gross_revenue: '100.00',
      deductions: '150.00',
      net_royalty: '50.00',
      currency: 'USD',
      status: 'finalized',
    }),
    { JWT_SECRET: secret },
    adapter,
    {},
  );
  assert.equal(excessiveDeductions.status, 400);
  const errJson = await excessiveDeductions.json();
  assert.match(errJson.error, /Deductions cannot exceed gross revenue/i);
});

// 11. Streaming agregat tidak dijumlahkan ganda dengan rincian per track
test('11. Aggregate streaming reports and track-level streaming remain strictly separated', async () => {
  const migration = await readFile(new URL('../migrations/0004_artist_streaming_royalty_input.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\."ArtistStreamingAggregate"/);
  // Confirms ArtistStreamingAggregate is an independent table and does not insert into public."Streaming"
  assert.ok(!migration.includes('INSERT INTO public."Streaming"'));
});

// 12. Saldo dan transaksi tetap konsisten dengan aturan keuangan yang berlaku
test('12. Royalty corrections supersede prior entries, reverse old ledger credit, and write new credit atomically', async () => {
  let executedSql = '';
  let paramsUsed = [];
  const adapter = new NeonAdapter({
    async query(sql, params) {
      executedSql = sql;
      paramsUsed = params;
      return {
        rows: [
          {
            id: 'royalty-row-v2',
            artistId,
            artistName: 'Luna Eclipse',
            ownerId: artistOwnerId,
            ownerEmail: 'luna@example.test',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            streams: '45000',
            grossRevenue: '150.00',
            deductions: '15.00',
            netRoyalty: '135.00',
            currency: 'USD',
            status: 'finalized',
            supersedesId: 'royalty-row-v1',
            revision: 2,
            createdBy: adminId,
            createdAt: '2026-09-01T12:00:00Z',
          },
        ],
      };
    },
  });

  const corrected = await adapter.correctManualArtistRoyalty('royalty-row-v1', {
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    streams: 45000,
    gross_revenue: '150.00',
    deductions: '15.00',
    net_royalty: '135.00',
    currency: 'USD',
    status: 'finalized',
  }, adminId, 'Correcting gross revenue adjustment from DSP report');

  assert.equal(corrected.revision, 2);
  assert.equal(corrected.supersedes_id, 'royalty-row-v1');
  assert.match(executedSql, /UPDATE public\."ManualArtistRoyalty" r SET status = 'superseded'/);
  assert.match(executedSql, /'adjustment_credit', -p\."netRoyalty"/);
  assert.match(executedSql, /'manual_artist_royalty_reversal'/);
  assert.match(executedSql, /'manual-artist-royalty-reversal:' \|\| p\.id::text/);
  assert.match(executedSql, /'royalty_credit', i\."netRoyalty"/);
  assert.match(executedSql, /'MANUAL_ARTIST_ROYALTY_CORRECTED'/);
});

// 13. Tes Potongan Otomatis & Format Angka Indonesia
test('13. Automatic deduction calculation and Indonesian number format parsing', async () => {
  const req100k = request('/api/admin/artist-finance/royalties', 'POST', jwt(adminId, 'admin'), {
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    gross_revenue: '100.000', // Rp100.000 (Indonesian format with dot)
    deductions: '30.000',    // 30% -> Rp30.000
    net_royalty: '70.000',   // Bersih -> Rp70.000
    currency: 'IDR',
    status: 'draft',
  });

  let capturedParams = null;
  const adapter = {
    ...baseSessionAdapter(),
    async createManualArtistRoyalty(data, actorId) {
      capturedParams = { data, actorId };
      return {
        id: 'royalty-idr-1',
        ...data,
      };
    },
  };

  const res100k = await handleAdminArtistFinance(req100k, { JWT_SECRET: secret }, adapter, {});
  assert.equal(res100k.status, 201);
  assert.equal(capturedParams.data.gross_revenue, '100000.00');
  assert.equal(capturedParams.data.deductions, '30000.00');
  assert.equal(capturedParams.data.net_royalty, '70000.00');

  // Test Rp1.500.000 with 10% deduction -> Rp1.350.000
  const req1_5M = request('/api/admin/artist-finance/royalties', 'POST', jwt(adminId, 'admin'), {
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    gross_revenue: '1.500.000',
    deductions: '150.000',
    net_royalty: '1.350.000',
    currency: 'IDR',
    status: 'draft',
  });
  const res1_5M = await handleAdminArtistFinance(req1_5M, { JWT_SECRET: secret }, adapter, {});
  assert.equal(res1_5M.status, 201);
  assert.equal(capturedParams.data.gross_revenue, '1500000.00');
  assert.equal(capturedParams.data.deductions, '150000.00');
  assert.equal(capturedParams.data.net_royalty, '1350000.00');

  // Test 0% deduction (Gross = Net)
  const req0Percent = request('/api/admin/artist-finance/royalties', 'POST', jwt(adminId, 'admin'), {
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    gross_revenue: '100000',
    deductions: '0',
    net_royalty: '100000',
    currency: 'IDR',
    status: 'draft',
  });
  const res0Percent = await handleAdminArtistFinance(req0Percent, { JWT_SECRET: secret }, adapter, {});
  assert.equal(res0Percent.status, 201);
  assert.equal(capturedParams.data.gross_revenue, '100000.00');
  assert.equal(capturedParams.data.deductions, '0.00');
  assert.equal(capturedParams.data.net_royalty, '100000.00');

  // Test 100% deduction (Deductions = Gross, Net = 0)
  const req100Percent = request('/api/admin/artist-finance/royalties', 'POST', jwt(adminId, 'admin'), {
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    gross_revenue: '100.000',
    deductions: '100.000',
    net_royalty: '0',
    currency: 'IDR',
    status: 'draft',
  });
  const res100Percent = await handleAdminArtistFinance(req100Percent, { JWT_SECRET: secret }, adapter, {});
  assert.equal(res100Percent.status, 201);
  assert.equal(capturedParams.data.gross_revenue, '100000.00');
  assert.equal(capturedParams.data.deductions, '100000.00');
  assert.equal(capturedParams.data.net_royalty, '0.00');

  // Test decimals in Indonesian format: 100.000,50 -> 100000.50
  const reqDecimalIndo = request('/api/admin/artist-finance/royalties', 'POST', jwt(adminId, 'admin'), {
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    gross_revenue: '100.000,50',
    deductions: '30.000,15',
    net_royalty: '70.000,35',
    currency: 'IDR',
    status: 'draft',
  });
  const resDecimalIndo = await handleAdminArtistFinance(reqDecimalIndo, { JWT_SECRET: secret }, adapter, {});
  assert.equal(resDecimalIndo.status, 201);
  assert.equal(capturedParams.data.gross_revenue, '100000.50');
  assert.equal(capturedParams.data.deductions, '30000.15');
  assert.equal(capturedParams.data.net_royalty, '70000.35');
});

// 14. Draft status tidak mengubah saldo artis, Finalisasi mengkredit saldo dan mencatat audit metadata lengkap
test('14. Draft status does not alter balance; Finalization records idempotent ledger credit with full metadata', async () => {
  let executedSql = '';
  let capturedQueryArgs = null;
  const neonAdapter = new NeonAdapter({
    async query(sql, params) {
      executedSql = sql;
      capturedQueryArgs = params;
      return {
        rows: [
          {
            id: 'royalty-final-1',
            artistId,
            artistName: 'Luna Eclipse',
            ownerId: artistOwnerId,
            ownerEmail: 'luna@example.test',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            streams: '50000',
            grossRevenue: '100000.00',
            deductions: '30000.00',
            netRoyalty: '70000.00',
            currency: 'IDR',
            status: 'finalized',
            createdBy: adminId,
            createdAt: '2026-09-01T10:00:00Z',
          },
        ],
      };
    },
  });

  const created = await neonAdapter.createManualArtistRoyalty({
    artist_id: artistId,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    streams: 50000,
    gross_revenue: '100000.00',
    deductions: '30000.00',
    net_royalty: '70000.00',
    currency: 'IDR',
    status: 'finalized',
  }, adminId);

  assert.equal(created.status, 'finalized');
  assert.equal(created.net_royalty, '70000.00');

  // Verify FinancialLedgerEntry query conditions
  assert.match(executedSql, /INSERT INTO public\."FinancialLedgerEntry"/);
  assert.match(executedSql, /WHERE i\.status = 'finalized' AND i\."netRoyalty" > 0/);
  assert.match(executedSql, /ON CONFLICT \("idempotencyKey"\) DO NOTHING/);
  assert.match(executedSql, /'manual-artist-royalty:' \|\| i\.id::text/);
  assert.match(executedSql, /'deductionPercent'/);
  assert.match(executedSql, /'grossRevenue'/);
  assert.match(executedSql, /'deductions'/);
  assert.match(executedSql, /'netRoyalty'/);
  assert.match(executedSql, /'artistName'/);
  assert.match(executedSql, /'currency'/);
});

// 15. Mode streaming agregat tidak mewajibkan nama platform dan otomatis diset ke Agregat
test('15. Aggregate streaming mode does not require platform name and defaults to Agregat', async () => {
  let capturedInput = null;
  const adapter = {
    ...baseSessionAdapter(),
    async createArtistStreamingAggregate(input, actorId) {
      capturedInput = { input, actorId };
      return { id: 'stream-agg-1', ...input };
    },
  };

  const req = request('/api/admin/artist-finance/streaming', 'POST', jwt(adminId, 'admin'), {
    artist_id: artistId,
    is_aggregate: true,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    streams: 250000,
  });

  const res = await handleAdminArtistFinance(req, { JWT_SECRET: secret }, adapter, {});
  assert.equal(res.status, 201);
  assert.equal(capturedInput.input.platform, 'Agregat');
  assert.equal(capturedInput.input.streams, 250000);
});

// 16. Admin dashboard stats includes both DSP and manual artist finance data
test('16. Admin dashboard stats combines DSP and manual streaming and royalties accurately', async () => {
  const executedQueries = [];
  const fakeClient = {
    async query(sql) {
      executedQueries.push(sql);
      if (sql.includes('public."ArtistStreamingAggregate"')) {
        return { rows: [{ total: '50000' }] };
      }
      if (sql.includes('FROM "Streaming"')) {
        return { rows: [{ total: '150000' }] };
      }
      if (sql.includes('public."ManualArtistRoyalty"')) {
        return { rows: [{ total: '70000.00' }] };
      }
      if (sql.includes('FROM "Royalty"')) {
        return { rows: [{ total: '30000.00' }] };
      }
      if (sql.includes('FROM users')) {
        return { rows: [{ total: '10' }] };
      }
      if (sql.includes('FROM "Release"')) {
        return { rows: [{ total: '5' }] };
      }
      if (sql.includes('FROM "Withdrawal"')) {
        return { rows: [{ total: '1' }] };
      }
      return { rows: [{ total: '0' }] };
    },
  };

  const adapter = new NeonAdapter('postgresql://test:test@ep-fake.neon.tech/neondb?sslmode=require');
  adapter.client = fakeClient;

  const stats = await adapter.getAdminDashboardStats();
  assert.equal(stats.totalStreams, 200000); // 150000 DSP + 50000 manual
  assert.equal(stats.dspStreams, 150000);
  assert.equal(stats.manualStreams, 50000);
  assert.equal(stats.totalRevenue, 100000); // 30000 DSP + 70000 manual
  assert.equal(stats.dspReportedRevenue, 30000);
  assert.equal(stats.allocatedArtistRoyalty, 70000);
});

// 17. Artist royalty endpoint returns royalty history while draft entries are marked estimated
test('17. Artist royalty endpoint returns manual royalties with correct status without leaking other accounts', async () => {
  const adapter = {
    ...baseSessionAdapter(),
    async listArtists(ownerId) {
      if (ownerId === artistOwnerId) {
        return { data: [{ id: artistId, owner_id: artistOwnerId, stageName: 'Asep' }], total: 1 };
      }
      return { data: [], total: 0 };
    },
    async getRoyalties() {
      return { data: [], total: 0 };
    },
    async listManualArtistRoyalties(filters) {
      assert.equal(filters.owner_id, artistOwnerId);
      return {
        data: [
          {
            id: 'roy-1',
            artist_id: artistId,
            owner_id: artistOwnerId,
            artist_name: 'Asep',
            period_start: '2026-08-01',
            period_end: '2026-08-31',
            streams: 10000,
            gross_revenue: '100000.00',
            deductions: '30000.00',
            net_royalty: '70000.00',
            currency: 'IDR',
            status: 'draft',
            created_at: '2026-08-15T00:00:00.000Z',
          },
          {
            id: 'roy-2',
            artist_id: artistId,
            owner_id: artistOwnerId,
            artist_name: 'Asep',
            period_start: '2026-07-01',
            period_end: '2026-07-31',
            streams: 20000,
            gross_revenue: '200000.00',
            deductions: '60000.00',
            net_royalty: '140000.00',
            currency: 'IDR',
            status: 'finalized',
            created_at: '2026-07-15T00:00:00.000Z',
          },
        ],
        total: 2,
      };
    },
  };

  const req = request('/api/royalties', 'GET', jwt(artistOwnerId, 'user'));
  const res = await handleRoyalties(req, { JWT_SECRET: secret }, adapter, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.data.length, 2);

  const draftItem = body.data.data.find((r) => r.id === 'roy-1');
  const finalizedItem = body.data.data.find((r) => r.id === 'roy-2');
  assert.equal(draftItem.status, 'estimated');
  assert.equal(draftItem.amount, 70000);
  assert.equal(finalizedItem.status, 'finalized');
  assert.equal(finalizedItem.amount, 140000);
});

