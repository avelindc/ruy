import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';

import { handleAdminRoyaltyRules, handleAdminWithdrawals, handleCsvImport, handleReleaseReview } from '../dist/handlers/adminHandler.js';
import { handleRoyalties } from '../dist/index.js';
import { handleReleaseSubmit, handleStorageGet, handleUpload, getStorageOwnerId } from '../dist/handlers/storageHandler.js';
import { NeonAdapter } from '../dist/adapters/neonAdapter.js';
import { readFile } from 'node:fs/promises';

const secret = 'worker-integration-test-only-not-a-production-secret';
const artistId = 'd2719f60-1c4d-4da9-8e19-8dcaa44e4931';
const adminId = '8ee5177c-88bd-46d1-8e89-362747b3a6fa';
const trackId = '4b16f8d3-aaef-44db-a3a4-b52437dd7702';
const releaseId = 'cb043bf6-b209-446a-8e97-75dc96d1942b';

function jwt(userId, role = 'user') {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const message = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId, email: `${role}@example.test`, user_role: role, jti: userId,
    iat: now, exp: now + 3600, aud: 'breakout-music', iss: 'breakout-music-api',
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

function sessionAdapter(userId, role = 'user') {
  return {
    async getUser(id) { return { id, email: `${id}@example.test`, role: id === userId ? role : 'user', artist_id: '37383288262714', account_status: 'active' }; },
    async isAuthSessionValid(id, jti) { return id === jti; },
  };
}

test('private audio storage requires owner authentication and denies another account', async () => {
  const fileKey = `audio/${artistId}/file-1.wav`;
  assert.equal(getStorageOwnerId(fileKey), artistId);
  assert.equal(getStorageOwnerId(`audio/${adminId}/file.wav`), adminId);
  assert.equal(getStorageOwnerId('audio/../../secret.wav'), null);

  const adapter = sessionAdapter(artistId);
  const env = {
    JWT_SECRET: secret,
    STORAGE_BUCKET: {
      async get(key) { return key === fileKey ? { body: new Uint8Array([1, 2, 3]), size: 3, httpMetadata: { contentType: 'audio/wav' } } : null; },
    },
  };
  const headers = {};
  const anonymous = await handleStorageGet(request('/api/storage/file', 'GET'), env, adapter, headers, fileKey);
  assert.equal(anonymous.status, 401);

  const owner = await handleStorageGet(request('/api/storage/file', 'GET', jwt(artistId)), env, adapter, headers, fileKey);
  assert.equal(owner.status, 200);
  assert.equal(owner.headers.get('cache-control'), 'private, max-age=60');

  const other = await handleStorageGet(request('/api/storage/file', 'GET', jwt(adminId)), env, adapter, headers, fileKey);
  assert.equal(other.status, 403);
});

test('R2 upload path streams the master file after checking its content signature', async () => {
  const form = new FormData();
  form.set('type', 'audio');
  form.set('file', new File([new Uint8Array([0x49, 0x44, 0x33, 0, 0, 0, 0, 0, 0, 0, 0, 0])], 'master.mp3', { type: 'audio/mpeg' }));
  let uploadedBody;
  const env = {
    JWT_SECRET: secret,
    STORAGE_BUCKET: {
      async put(_key, body) { uploadedBody = body; },
      async head() { return { size: 12 }; },
    },
  };
  const response = await handleUpload(new Request('https://api.example.test/api/uploads', {
    method: 'POST', headers: { Authorization: `Bearer ${jwt(artistId)}` }, body: form,
  }), env, sessionAdapter(artistId), {});
  assert.equal(response.status, 201);
  assert.equal(typeof uploadedBody.getReader, 'function');
  assert.equal((await response.json()).data.storageProvider, 'cloudflare-r2');
});

test('release submission verifies ownership, rights acknowledgement, and persistent file presence', async () => {
  const user = { ...sessionAdapter(artistId) };
  const release = {
    id: releaseId, owner_id: artistId, status: 'draft', distribution_rights_confirmed: true,
    artwork_url: `https://api.example.test/api/storage/covers/${artistId}/cover.webp`,
  };
  const track = {
    id: trackId, owner_id: artistId, release_id: releaseId, title: 'Test track',
    audio_url: `https://api.example.test/api/storage/audio/${artistId}/master.wav`,
    distribution_rights_confirmed: true,
  };
  Object.assign(user, {
    async getRelease() { return release; },
    async listTracks() { return { data: [track], total: 1 }; },
    async verifyUploadExists() { return true; },
    async updateReleaseStatus(_id, status) { return { ...release, status }; },
  });
  const response = await handleReleaseSubmit(
    request(`/api/releases/${releaseId}/submit`, 'POST', jwt(artistId), {}),
    { JWT_SECRET: secret }, user, {}, releaseId,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'REVIEW');

  release.status = 'rejected';
  const resubmission = await handleReleaseSubmit(
    request(`/api/releases/${releaseId}/submit`, 'POST', jwt(artistId), {}),
    { JWT_SECRET: secret }, user, {}, releaseId,
  );
  assert.equal(resubmission.status, 200);
  assert.equal((await resubmission.json()).data.status, 'REVIEW');

  release.distribution_rights_confirmed = false;
  const rejected = await handleReleaseSubmit(
    request(`/api/releases/${releaseId}/submit`, 'POST', jwt(artistId), {}),
    { JWT_SECRET: secret }, user, {}, releaseId,
  );
  assert.equal(rejected.status, 400);
});

function adminImportAdapter() {
  const adapter = sessionAdapter(adminId, 'admin');
  const writes = { rows: [], errors: [], updated: undefined };
  Object.assign(adapter, {
    writes,
    async getTrackByIsrc(isrc) {
      return isrc === 'USABC1234567' ? { id: trackId, release_id: releaseId, owner_id: artistId } : null;
    },
    async getRelease(id) {
      return id === releaseId ? { id: releaseId, owner_id: artistId, upc: '123456789012' } : null;
    },
    async getCsvImportStatus() {
      return { id: 'import-id', status: 'processing', period_start: '2026-01-01', period_end: '2026-01-31' };
    },
    async hasStreamingDuplicate() { return false; },
    async hasStreamingIdentityDuplicate() { return false; },
    async createStreamingRecord(row) { writes.rows.push(row); return row; },
    async createCsvImportErrors(_id, errors) { writes.errors.push(...errors); },
    async updateCsvImport(_id, value) { writes.updated = value; },
    async createAuditLog() {},
  });
  return adapter;
}

test('CSV ingestion revalidates and matches ISRC/UPC server-side; ignores client hash', async () => {
  const adapter = adminImportAdapter();
  const response = await handleCsvImport(request('/api/admin/csv-import/import-id/rows', 'POST', jwt(adminId, 'admin'), {
    rows: [{
      isrc: 'USABC1234567', upc: '123456789012', platform: 'Spotify', territory: 'US',
      reportingPeriod: '2026-01-15', streams: 15, revenue: 1.25, currency: 'USD',
      sourceRowHash: 'attacker-controlled-hash', trackId, releaseId, rawRow: 'source row',
    }],
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.insertedRecords, 1);
  assert.equal(adapter.writes.rows.length, 1);
  assert.equal(adapter.writes.rows[0].track_id, trackId);
  assert.equal(adapter.writes.rows[0].release_id, releaseId);
  assert.match(adapter.writes.rows[0].source_row_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(adapter.writes.rows[0].source_row_hash, 'attacker-controlled-hash');
  assert.equal(adapter.writes.rows[0].net_revenue, 1.25);
});

test('CSV ingestion stores mismatched client track linkage as an unmatched error', async () => {
  const adapter = adminImportAdapter();
  const response = await handleCsvImport(request('/api/admin/csv-import/import-id/rows', 'POST', jwt(adminId, 'admin'), {
    rows: [{
      isrc: 'USABC1234567', upc: '123456789012', platform: 'Spotify', territory: 'US',
      reportingPeriod: '2026-01-15', streams: 15, revenue: 1.25, currency: 'USD',
      trackId: randomUUID(), releaseId, rawRow: 'source row',
    }],
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.insertedRecords, 0);
  assert.equal(body.data.invalidRows, 1);
  assert.equal(adapter.writes.rows.length, 0);
  assert.equal(adapter.writes.errors[0].error_code, 'MATCH_MISMATCH');
  assert.equal(adapter.writes.updated.status, 'partial');
});

test('CSV ingestion rejects oversized row batches instead of silently truncating them', async () => {
  const adapter = adminImportAdapter();
  const response = await handleCsvImport(request('/api/admin/csv-import/import-id/rows', 'POST', jwt(adminId, 'admin'), {
    rows: Array.from({ length: 5001 }, () => ({})),
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(response.status, 400);
  assert.equal(adapter.writes.rows.length, 0);
  assert.equal(adapter.writes.updated, undefined);
});

test('CSV revenue corrections with an existing natural row identity are blocked from double counting', async () => {
  const adapter = adminImportAdapter();
  adapter.hasStreamingIdentityDuplicate = async () => true;
  const response = await handleCsvImport(request('/api/admin/csv-import/import-id/rows', 'POST', jwt(adminId, 'admin'), {
    rows: [{
      isrc: 'USABC1234567', upc: '123456789012', platform: 'Spotify', territory: 'US',
      reportingPeriod: '2026-01-15', streams: 15, revenue: 9.99, currency: 'USD', trackId, releaseId,
    }],
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.insertedRecords, 0);
  assert.equal(body.data.invalidRows, 1);
  assert.equal(adapter.writes.errors[0].error_code, 'DUPLICATE_OR_CORRECTION_REQUIRED');
  assert.match(adapter.writes.errors[0].error_message, /correction workflow/i);
});

test('release creation persists structured credits and rights metadata through parameterized Neon writes', async () => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('SELECT id, "stageName" FROM "Artist"')) return { rows: [{ id: releaseId, stageName: 'Artist Name' }] };
      if (sql.includes('INSERT INTO "Release"')) return { rows: [{
        id: releaseId, artistId: releaseId, title: 'Release title', type: 'SINGLE',
        releaseDate: '2026-06-01', status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }] };
      return { rows: [] };
    },
    async transaction(queries) {
      const results = [];
      for (const query of queries) results.push(await this.query(query.text, query.values || []));
      return results;
    },
  };
  const adapter = new NeonAdapter(client);
  await adapter.createRelease(artistId, {
    title: 'Release title', release_type: 'single', primary_artist_id: releaseId,
    release_date: '2026-06-01', genre: 'Electronic', language: 'en',
    self_released: true, distribution_rights_confirmed: true,
    featured_artists: ['Featured One'],
    tracks: [{ title: 'Track title', composers: ['Composer One', 'Composer Two'], songwriters: ['Writer One'], producers: ['Producer One'], distribution_rights_confirmed: true }],
  });
  const releaseInsert = calls.find((call) => call.sql.includes('INSERT INTO "Release"'));
  assert.match(releaseInsert.sql, /"releaseVersion"/);
  assert.equal(releaseInsert.values[13], true);
  assert.equal(releaseInsert.values[17], true);
  const trackInsert = calls.find((call) => call.sql.includes('INSERT INTO "Track"'));
  assert.deepEqual(trackInsert.values[8], ['Composer One', 'Composer Two']);
  assert.deepEqual(trackInsert.values[9], ['Writer One']);
  assert.deepEqual(trackInsert.values[10], ['Producer One']);
  assert.equal(trackInsert.values[15], true);
});

test('admin rejection requires a reason and records it through the status-transition adapter', async () => {
  const adapter = sessionAdapter(adminId, 'admin');
  let transition;
  Object.assign(adapter, {
    async updateReleaseStatus(id, status, reason, actorId) {
      transition = { id, status, reason, actorId };
      return { id, status: 'rejected', rejection_reason: reason };
    },
  });
  const missingReason = await handleReleaseReview(request(`/api/admin/releases-review/${releaseId}`, 'PUT', jwt(adminId, 'admin'), {
    status: 'rejected',
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(missingReason.status, 400);
  assert.equal(transition, undefined);

  const response = await handleReleaseReview(request(`/api/admin/releases-review/${releaseId}`, 'PUT', jwt(adminId, 'admin'), {
    status: 'rejected', reason: 'Artwork does not meet requirements.',
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(response.status, 200);
  assert.deepEqual(transition, { id: releaseId, status: 'REJECTED', reason: 'Artwork does not meet requirements.', actorId: adminId });
  assert.equal((await response.json()).data.rejection_reason, 'Artwork does not meet requirements.');
});

test('artist metadata updates are guarded by database status and cannot race an approval', async () => {
  let updateSql;
  const adapter = new NeonAdapter({
    async query(sql) {
      if (sql.includes('SELECT * FROM "Release"')) return { rows: [{ id: releaseId, status: 'APPROVED', artistId }] };
      if (sql.includes('SELECT status FROM "Release"')) return { rows: [{ status: 'APPROVED' }] };
      return { rows: [] };
    },
    async transaction(queries) {
      updateSql = queries[0].text;
      return [{ rows: [] }];
    },
  });
  await assert.rejects(adapter.updateRelease(releaseId, { title: 'Changed title' }), /only be changed while.*draft or rejected/i);
  assert.match(updateSql, /status IN \('PENDING', 'REJECTED'\)/);
});

test('admin can configure only explicit supported USD royalty rules', async () => {
  const adapter = sessionAdapter(adminId, 'admin');
  let savedRule;
  Object.assign(adapter, {
    async createRoyaltyRule(rule, createdBy) { savedRule = { ...rule, id: randomUUID(), created_by: createdBy }; return savedRule; },
    async createAuditLog() {},
  });
  const accepted = await handleAdminRoyaltyRules(request('/api/admin/royalty-rules', 'POST', jwt(adminId, 'admin'), {
    artist_id: releaseId, platform: 'spotify', share_percent: 65, revenue_basis: 'net', currency: 'USD',
    effective_from: '2026-01-01', effective_until: null,
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(accepted.status, 201);
  assert.equal(savedRule.share_percent, 65);
  assert.equal(savedRule.currency, 'USD');

  const noFx = await handleAdminRoyaltyRules(request('/api/admin/royalty-rules', 'POST', jwt(adminId, 'admin'), {
    artist_id: releaseId, platform: 'spotify', share_percent: 65, revenue_basis: 'net', currency: 'EUR', effective_from: '2026-01-01',
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(noFx.status, 400);

  const ordinaryUser = await handleAdminRoyaltyRules(request('/api/admin/royalty-rules', 'GET', jwt(artistId)), adapter, {}, { JWT_SECRET: secret });
  assert.equal(ordinaryUser.status, 403);
});

test('royalty processing is routed through the idempotent database batch function', async () => {
  const adapter = adminImportAdapter();
  let called;
  adapter.processStreamingReportRoyalties = async (reportId, actorId) => { called = { reportId, actorId }; return 'batch-uuid'; };
  const response = await handleCsvImport(request('/api/admin/csv-import/import-id/royalties', 'POST', jwt(adminId, 'admin'), {}), adapter, {}, { JWT_SECRET: secret });
  assert.equal(response.status, 200);
  assert.deepEqual(called, { reportId: 'import-id', actorId: adminId });
  assert.equal((await response.json()).data.batchId, 'batch-uuid');
});

test('artist royalty calculation API is scoped to the authenticated user', async () => {
  const adapter = sessionAdapter(artistId);
  let queriedUserId;
  Object.assign(adapter, {
    async getRoyaltyCalculationItemsForOwner(userId, limit, offset) {
      queriedUserId = userId;
      assert.equal(limit, 500);
      assert.equal(offset, 0);
      return { total: 1, data: [{ id: 'item-1', track_title: 'Track A', artist_name: 'Artist A', amount: 4.25, currency: 'USD' }] };
    },
  });
  const response = await handleRoyalties(
    request('/api/royalties/calculation-items?user_id=another-user&limit=500', 'GET', jwt(artistId)),
    { JWT_SECRET: secret }, adapter, {},
  );
  assert.equal(response.status, 200);
  assert.equal(queriedUserId, artistId);
  assert.equal((await response.json()).data.data[0].amount, 4.25);
});

test('royalty calculation item queries enforce Artist ownership in Neon', async () => {
  const calls = [];
  const adapter = new NeonAdapter({
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }] };
      return { rows: [{
        id: 'item-1', trackId, trackTitle: 'Track A', isrc: 'USABC1234567', releaseId,
        releaseTitle: 'Release A', artistId, artistName: 'Artist A', platform: 'spotify',
        periodStart: '2026-01-01', streams: '10', grossRevenue: '5.00', deductions: '1.00',
        netRevenue: '4.00', sharePercent: '50.0000', royaltyAmount: '2.00', currency: 'USD',
        batchStatus: 'completed', completedAt: '2026-02-01T00:00:00.000Z',
      }] };
    },
  });
  const result = await adapter.getRoyaltyCalculationItemsForOwner(artistId);
  assert.equal(result.total, 1);
  assert.equal(result.data[0].amount, 2);
  assert.equal(result.data[0].platform, 'spotify');
  assert.ok(calls.every((call) => call.sql.includes('a."userId" = $1')));
  assert.ok(calls.every((call) => call.values[0] === artistId));
});

test('ledger balance summary stays separated by currency and comes from signed entries', async () => {
  let sqlText;
  const adapter = new NeonAdapter({
    async query(sql) {
      sqlText = sql;
      return { rows: [{ currency: 'USD', balance: '42.50', total_earned: '70.00', total_withdrawn: '27.50' }] };
    },
  });
  const result = await adapter.getFinancialLedgerSummary(artistId);
  assert.match(sqlText, /GROUP BY currency/);
  assert.match(sqlText, /"userId" = \$1/);
  assert.deepEqual(result[0], { currency: 'USD', balance: 42.5, total_earned: 70, total_withdrawn: 27.5 });
});

test('finance migration defines explicit shares, decimal batches, idempotent ledger, and USD-only calculation', async () => {
  const migration = await readFile(new URL('../migrations/0003_release_streaming_finance.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\."RoyaltyRule"/);
  assert.match(migration, /sharePercent" numeric\(7,4\) NOT NULL CHECK/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\."RoyaltyCalculationItem"/);
  assert.match(migration, /"reportId" uuid NOT NULL UNIQUE/);
  assert.match(migration, /UNIQUE \("batchId", "trackId", platform, "periodStart", currency, "ruleId"\)/);
  assert.match(migration, /"idempotencyKey" text NOT NULL UNIQUE/);
  assert.match(migration, /streaming_source_identity_unique_idx/);
  assert.match(migration, /process_streaming_report_royalties/);
  assert.match(migration, /Every report row must match exactly one active/);
  assert.match(migration, /Only USD reports|USD reports only/);
  assert.match(migration, /INSERT INTO public\."RoyaltyRule"[\s\S]*?VALUES \(p_artist_id/);
  assert.match(migration, /INSERT INTO public\."AuditLog"[\s\S]*?royalty\.rule_created/);
  assert.match(migration, /'withdrawal_reserve'[\s\S]*'withdrawal_release'[\s\S]*'withdrawal_debit'/);
  assert.match(migration, /"ruleSnapshot" = COALESCE\([\s\S]*'ruleId'[\s\S]*"sharePercent"/);
});

test('withdrawal invalid transitions are reported separately from missing records', async () => {
  const adapter = new NeonAdapter({
    async query(sql) {
      if (sql.includes('WITH prior AS MATERIALIZED')) return { rows: [] };
      if (sql.includes('SELECT status FROM "Withdrawal"')) return { rows: [{ status: 'pending' }] };
      return { rows: [] };
    },
  });
  await assert.rejects(adapter.updateWithdrawalStatus('withdrawal-id', 'paid', undefined, adminId), /cannot transition from pending to paid/);
});

test('admin withdrawal approval is reachable and rejection requires a reason', async () => {
  const adapter = sessionAdapter(adminId, 'admin');
  const calls = [];
  Object.assign(adapter, {
    async updateWithdrawalStatus(...args) { calls.push(args); return { id: args[0], status: args[1] }; },
  });
  const approved = await handleAdminWithdrawals(request('/api/admin/withdrawals/w1', 'PUT', jwt(adminId, 'admin'), {
    status: 'approved',
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(approved.status, 200);
  assert.equal(calls[0][1], 'approved');

  const rejectedWithoutReason = await handleAdminWithdrawals(request('/api/admin/withdrawals/w1', 'PUT', jwt(adminId, 'admin'), {
    status: 'rejected',
  }), adapter, {}, { JWT_SECRET: secret });
  assert.equal(rejectedWithoutReason.status, 400);
  assert.equal(calls.length, 1);
});

test('paid withdrawal settlement releases its reserve and records a payout debit atomically', async () => {
  let sqlText;
  const adapter = new NeonAdapter({
    async query(sql) {
      sqlText = sql;
      return { rows: [{ id: 'w1', userId: artistId, amount: '50.00', currency: 'USD', status: 'paid' }] };
    },
  });
  const result = await adapter.updateWithdrawalStatus('w1', 'paid', 'transfer-ref', adminId);
  assert.equal(result.status, 'paid');
  assert.match(sqlText, /WITH prior AS MATERIALIZED[\s\S]*ledger_lines AS/);
  assert.match(sqlText, /'withdrawal_release'[\s\S]*'withdrawal_debit'/);
  assert.match(sqlText, /ON CONFLICT \("idempotencyKey"\) DO NOTHING/);
});
