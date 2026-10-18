/**
 * BREAKOUT MUSIC — Neon PostgreSQL Adapter
 *
 * Implements the DatabaseAdapter interface using Neon PostgreSQL.
 * Handles all database queries and transformations.
 */

interface SqlClient {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
  transaction?(queries: Array<{ text: string; values?: unknown[] }>): Promise<Array<{ rows: any[] }>>;
}
import type {
  DatabaseAdapter,
  User,
  UserInput,
  Artist,
  ArtistInput,
  Release,
  ReleaseInput,
  Track,
  TrackInput,
  StreamingRecord,
  StreamingFilter,
  RoyaltyEntry,
  AuditLog,
  AuditLogFilter,
  Withdrawal,
  NotificationRecord,
  CsvImport,
  CmsLandingSection,
  CmsTestimonial,
  CmsFaqCategory,
  CmsFaqItem,
  CmsScrollytelling,
  CmsScrollytellingFrame,
  CmsScrollytellingStep,
  RoyaltyRuleInput,
} from '../types/database';
import { NotFoundError, ValidationError } from '../types/database';
import {
  transformNeonUser,
  transformNeonArtist,
  transformNeonRelease,
  transformNeonTrack,
  transformNeonStreaming,
  transformNeonRoyalty,
} from './transformers';

function cleanStringList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function validPositiveInteger(value?: number): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

export class NeonAdapter implements DatabaseAdapter {
  constructor(private client: SqlClient) {}

  // ========== USER OPERATIONS ==========

  async getUser(userId: string): Promise<User | null> {
    const query = `
      SELECT u.*, ur.role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE u.id = $1
    `;
    const result = await this.client.query(query, [userId]);
    return result.rows.length > 0 ? transformNeonUser(result.rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT u.*, ur.role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE lower(u.email) = lower($1)
    `;
    const result = await this.client.query(query, [email]);
    return result.rows.length > 0 ? transformNeonUser(result.rows[0]) : null;
  }

  async listUsers(limit: number = 50, offset: number = 0, search?: string): Promise<{ data: User[]; total: number }> {
    const searchPattern = search?.trim() ? `%${search.trim()}%` : null;
    const filter = '(($1::text IS NULL) OR u.email ILIKE $1 OR u.full_name ILIKE $1)';
    const countResult = await this.client.query(`SELECT COUNT(*) FROM users u WHERE ${filter}`, [searchPattern]);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT u.*, ur.role,
        COALESCE(artist_counts.artist_count, 0) AS artist_count,
        COALESCE(release_counts.release_count, 0) AS release_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN (
        SELECT "userId", COUNT(*) AS artist_count
        FROM "Artist"
        GROUP BY "userId"
      ) artist_counts ON artist_counts."userId" = u.id
      LEFT JOIN (
        SELECT a."userId", COUNT(r.id) AS release_count
        FROM "Artist" a
        LEFT JOIN "Release" r ON r."artistId" = a.id
        GROUP BY a."userId"
      ) release_counts ON release_counts."userId" = u.id
      WHERE ${filter}
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.client.query(query, [searchPattern, limit, offset]);

    return {
      data: result.rows.map((row: any) => ({
        ...transformNeonUser(row),
        artistCount: Number(row.artist_count || 0),
        releaseCount: Number(row.release_count || 0),
      })),
      total,
    };
  }

  async createUser(data: UserInput): Promise<User> {
    const userId = crypto.randomUUID();

    const query = `
      WITH created_user AS (
        INSERT INTO users (id, email, password_hash, full_name, account_status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      ), assigned_role AS (
        INSERT INTO user_roles (user_id, role)
        SELECT id, 'user' FROM created_user
        RETURNING user_id
      )
      SELECT created_user.*, 'user' AS role
      FROM created_user JOIN assigned_role ON assigned_role.user_id = created_user.id
    `;
    const result = await this.client.query(query, [
      userId,
      data.email,
      data.password_hash,
      data.full_name,
      data.account_status || 'active',
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    return transformNeonUser(result.rows[0]);
  }

  async createAuthSession(userId: string, tokenId: string, expiresAt: Date): Promise<void> {
    await this.client.query(
      'INSERT INTO user_sessions (user_id, token_jti, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenId, expiresAt],
    );
  }

  async isAuthSessionValid(userId: string, tokenId: string): Promise<boolean> {
    const result = await this.client.query(
      `SELECT EXISTS (
        SELECT 1 FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.user_id = $1 AND s.token_jti = $2
          AND s.revoked_at IS NULL AND s.expires_at > NOW()
          AND u.account_status = 'active'
      ) AS valid`,
      [userId, tokenId],
    );
    return result.rows[0]?.valid === true;
  }

  async revokeAuthSession(userId: string, tokenId: string): Promise<void> {
    await this.client.query(
      'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND token_jti = $2 AND revoked_at IS NULL',
      [userId, tokenId],
    );
  }

  async getAdminDashboardStats() {
    const [users, releases, streams, royalties, reviews, withdrawals] = await Promise.all([
      this.client.query('SELECT COUNT(*)::int AS total FROM users WHERE account_status <> \'deleted\''),
      this.client.query('SELECT COUNT(*)::int AS total FROM "Release"'),
      this.client.query('SELECT COALESCE(SUM("playCount"), 0)::bigint AS total FROM "Streaming"'),
      this.client.query('SELECT COALESCE(SUM("totalRevenue"), 0)::numeric AS total FROM "Royalty"'),
      this.client.query('SELECT COUNT(*)::int AS total FROM "Release" WHERE status IN (\'REVIEW\', \'PENDING\')'),
      this.client.query('SELECT COUNT(*)::int AS total FROM "Withdrawal" WHERE status IN (\'pending\', \'PENDING\')'),
    ]);
    return {
      totalUsers: Number(users.rows[0]?.total || 0),
      totalReleases: Number(releases.rows[0]?.total || 0),
      totalStreams: Number(streams.rows[0]?.total || 0),
      totalRevenue: Number(royalties.rows[0]?.total || 0),
      pendingReviews: Number(reviews.rows[0]?.total || 0),
      pendingWithdrawals: Number(withdrawals.rows[0]?.total || 0),
    };
  }

  async updateUser(userId: string, data: Partial<UserInput>): Promise<User> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.full_name !== undefined) {
      fields.push(`full_name = $${index++}`);
      values.push(data.full_name);
    }
    if (data.avatar_url !== undefined) {
      fields.push(`avatar_url = $${index++}`);
      values.push(data.avatar_url || null);
    }
    if (data.account_status !== undefined) {
      fields.push(`account_status = $${index++}`);
      values.push(data.account_status);
    }
    if (data.password_hash !== undefined) {
      fields.push(`password_hash = $${index++}`);
      values.push(data.password_hash);
    }
    if (fields.length === 0) throw new ValidationError('No user fields to update');

    fields.push('updated_at = NOW()');
    values.push(userId);
    const result = await this.client.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) throw new NotFoundError(`User ${userId} not found`);

    const roleResult = await this.client.query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    return transformNeonUser({ ...result.rows[0], role: roleResult.rows[0]?.role });
  }

  // ========== ARTIST OPERATIONS ==========

  async getArtist(artistId: string): Promise<Artist | null> {
    const query = 'SELECT * FROM "Artist" WHERE id = $1';
    const result = await this.client.query(query, [artistId]);
    return result.rows.length > 0 ? transformNeonArtist(result.rows[0]) : null;
  }

  async listArtists(ownerId?: string, limit: number = 50, offset: number = 0): Promise<{ data: Artist[]; total: number }> {
    let query = 'SELECT COUNT(*) FROM "Artist"';
    let countParams: any[] = [];

    if (ownerId) {
      query += ' WHERE "userId" = $1';
      countParams = [ownerId];
    }

    const countResult = await this.client.query(query, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    let selectQuery = 'SELECT * FROM "Artist"';
    let selectParams: any[] = [];

    if (ownerId) {
      selectQuery += ' WHERE "userId" = $1';
      selectParams = [ownerId];
      selectQuery += ` LIMIT $${selectParams.length + 1} OFFSET $${selectParams.length + 2}`;
      selectParams.push(limit, offset);
    } else {
      selectQuery += ` LIMIT $1 OFFSET $2`;
      selectParams = [limit, offset];
    }

    const result = await this.client.query(selectQuery, selectParams);

    return {
      data: result.rows.map(transformNeonArtist),
      total,
    };
  }

  async createArtist(ownerId: string, data: ArtistInput): Promise<Artist> {
    const query = `
      INSERT INTO "Artist" ("id", "userId", "stageName", "bio", "avatarUrl", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.client.query(query, [
      ownerId,
      data.artist_name,
      data.bio || null,
      data.avatar_url || null,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to create artist');
    }

    return transformNeonArtist(result.rows[0]);
  }

  async updateArtist(artistId: string, data: Partial<ArtistInput>): Promise<Artist> {
    const updates: string[] = [];
    const values: any[] = [artistId];
    let paramIndex = 2;

    if (data.artist_name) {
      updates.push(`"stageName" = $${paramIndex++}`);
      values.push(data.artist_name);
    }
    if (data.bio !== undefined) {
      updates.push(`"bio" = $${paramIndex++}`);
      values.push(data.bio || null);
    }
    if (data.avatar_url !== undefined) {
      updates.push(`"avatarUrl" = $${paramIndex++}`);
      values.push(data.avatar_url || null);
    }

    updates.push(`"updatedAt" = NOW()`);

    const query = `UPDATE "Artist" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.client.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Artist ${artistId} not found`);
    }

    return transformNeonArtist(result.rows[0]);
  }

  async deleteArtist(artistId: string): Promise<void> {
    const query = 'DELETE FROM "Artist" WHERE id = $1';
    await this.client.query(query, [artistId]);
  }

  private async enrichNeonRelease(row: any, fallbackOwnerId?: string): Promise<any> {
    let finalOwner = fallbackOwnerId || '';
    let artistName = row.primaryArtist || '';

    try {
      const artistResult = await this.client.query('SELECT "userId", "stageName" FROM "Artist" WHERE id = $1', [row.artistId]);
      if (artistResult.rows.length > 0) {
        if (artistResult.rows[0].userId) finalOwner = artistResult.rows[0].userId;
        if (artistResult.rows[0].stageName) artistName = artistResult.rows[0].stageName;
      }
    } catch {}

    // Tracks
    let tracks: any[] = [];
    try {
      const trackRes = await this.client.query(
        'SELECT * FROM "Track" WHERE "releaseId" = $1 ORDER BY "createdAt" ASC, id',
        [row.id]
      );
      tracks = trackRes.rows.map((t: any) => ({
        id: t.id,
        title: t.title,
        audio_url: t.audioUrl,
        isrc: t.isrc,
        tiktok_clip_start: t.tiktokClipStart,
        track_version: t.trackVersion || undefined,
        primary_artist: t.primaryArtist || artistName,
        featured_artists: t.featuredArtists || [],
        composers: t.composerNames || [],
        songwriters: t.songwriterNames || [],
        producers: t.producerNames || [],
        arrangers: t.arrangerNames || [],
        track_number: t.trackNumber || undefined,
        disc_number: t.discNumber || undefined,
        genre: t.genre || row.genre || undefined,
        language: t.language || row.language || undefined,
        explicit_content: Boolean(t.explicitContent),
        rights_ownership: t.rightsOwnership || undefined,
        distribution_rights_confirmed: Boolean(t.distributionRightsConfirmed),
      }));
    } catch {}

    let featuredArtists: string[] = [];
    try {
      const contributors = await this.client.query(
        'SELECT name FROM "ReleaseContributor" WHERE "releaseId" = $1 AND role = $2 ORDER BY position',
        [row.id, 'featured_artist'],
      );
      featuredArtists = contributors.rows.map((contributor) => contributor.name);
    } catch {}

    // Owner info
    let userName = 'Artis';
    let userEmail = '';
    if (finalOwner) {
      try {
        const uRes = await this.client.query('SELECT full_name as name, email FROM users WHERE id = $1', [finalOwner]);
        if (uRes.rows.length > 0) {
          userName = uRes.rows[0].name || userName;
          userEmail = uRes.rows[0].email || '';
        }
      } catch {}
    }

    const base = transformNeonRelease(row, finalOwner);
    const rawStatus = (row.status || '').toUpperCase();
    let normalizedStatus: string = 'submitted';
    if (rawStatus === 'APPROVED') normalizedStatus = 'approved';
    else if (rawStatus === 'REJECTED') normalizedStatus = 'rejected';
    else if (rawStatus === 'PENDING') normalizedStatus = 'draft';
    else if (rawStatus === 'REVIEW' || rawStatus === 'SUBMITTED') normalizedStatus = 'submitted';
    else if (rawStatus === 'RELEASED' || rawStatus === 'LIVE') normalizedStatus = 'live';

    return {
      ...base,
      artist_name: artistName,
      primaryArtist: artistName,
      genre: row.genre || 'Pop',
      cover_artwork_url: row.coverArtworkUrl,
      cover_url: row.coverArtworkUrl,
      artwork_url: row.coverArtworkUrl,
      featured_artists: featuredArtists,
      release_version: row.releaseVersion || undefined,
      subgenre: row.subgenre || undefined,
      original_release_date: row.originalReleaseDate || undefined,
      copyright_c: row.copyrightC || undefined,
      copyright_p: row.copyrightP || undefined,
      notes: row.notes || undefined,
      rejection_reason: row.rejectionReason || undefined,
      tracks,
      audio_url: tracks[0]?.audio_url || '',
      audio_name: tracks[0]?.title ? `${tracks[0].title}.mp3` : (row.title ? `${row.title}.mp3` : ''),
      user_name: userName,
      user_email: userEmail,
      status: normalizedStatus,
      raw_status: row.status,
    };
  }

  // ========== RELEASE OPERATIONS ==========

  async getRelease(releaseId: string): Promise<Release | null> {
    const query = 'SELECT * FROM "Release" WHERE id = $1';
    const result = await this.client.query(query, [releaseId]);

    if (result.rows.length === 0) return null;

    return this.enrichNeonRelease(result.rows[0]);
  }

  async listReleases(ownerId?: string, limit: number = 50, offset: number = 0): Promise<{ data: Release[]; total: number }> {
    let query = 'SELECT r.* FROM "Release" r';
    let countQuery = 'SELECT COUNT(*) FROM "Release" r';
    let params: any[] = [];

    if (ownerId) {
      // Join with Artist to filter by owner
      query = `
        SELECT r.* FROM "Release" r
        INNER JOIN "Artist" a ON r."artistId" = a.id
        WHERE a."userId" = $1
      `;
      countQuery = `
        SELECT COUNT(*) FROM "Release" r
        INNER JOIN "Artist" a ON r."artistId" = a.id
        WHERE a."userId" = $1
      `;
      params = [ownerId];
    }

    // Get total count
    const countParams = params.length > 0 ? params : [];
    const countResult = await this.client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results ordered by newest first
    const paginatedQuery = query + ` ORDER BY r."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await this.client.query(paginatedQuery, [...params, limit, offset]);

    const releases = await Promise.all(
      result.rows.map((row) => this.enrichNeonRelease(row, ownerId))
    );

    return { data: releases, total };
  }

  async listReleasesByArtist(artistId: string, limit: number = 50, offset: number = 0): Promise<{ data: Release[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM "Release" WHERE "artistId" = $1';
    const countResult = await this.client.query(countQuery, [artistId]);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = 'SELECT * FROM "Release" WHERE "artistId" = $1 LIMIT $2 OFFSET $3';
    const result = await this.client.query(query, [artistId, limit, offset]);

    // Get artist owner
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [artistId]);
    const ownerId = artistResult.rows[0]?.userId || artistId;

    return {
      data: await Promise.all(result.rows.map((row) => this.enrichNeonRelease(row, ownerId))),
      total,
    };
  }

  async createRelease(ownerId: string, data: ReleaseInput): Promise<Release> {
    // A release must reference an artist explicitly created by its owner.
    let artistId = data.primary_artist_id;
    if (!artistId) throw new ValidationError('Pilih atau buat profil artis sebelum membuat rilis.');
    let artistName = '';

    if (artistId) {
      const byId = await this.client.query('SELECT id, "stageName" FROM "Artist" WHERE id = $1 AND "userId" = $2', [artistId, ownerId]);
      if (byId.rows.length > 0) {
        artistName = byId.rows[0].stageName;
      } else {
        throw new ValidationError('Profil artis tidak ditemukan atau bukan milik akun ini.');
      }
    }

    const typeStr = data.release_type ? data.release_type.toUpperCase() : 'SINGLE';
    if (!['SINGLE', 'EP', 'ALBUM'].includes(typeStr)) throw new ValidationError('Invalid release type.');
    const releaseType = typeStr;
    const releaseDate = data.release_date || new Date().toISOString();
    const artworkUrl = data.artwork_url || data.cover_artwork_url || '';

    const releaseId = crypto.randomUUID();
    const releaseQuery = `
      INSERT INTO "Release" (
        "id", "artistId", "title", "type", "genre", "language", "primaryArtist",
        "releaseDate", "coverArtworkUrl", "status", "isImported", "upc",
        "releaseVersion", subgenre, "originalReleaseDate", "selfReleased", "copyrightC", "copyrightP",
        notes, "distributionRightsConfirmed", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', false, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING *
    `;

    const queries: Array<{ text: string; values?: unknown[] }> = [{ text: releaseQuery, values: [
      releaseId,
      artistId,
      data.title,
      releaseType,
      data.genre || null,
      data.language || null,
      artistName,
      releaseDate,
      artworkUrl,
      data.upc || null,
      data.release_version?.trim() || null,
      data.subgenre?.trim() || null,
      data.original_release_date || null,
      data.self_released === true,
      data.copyright_c?.trim() || null,
      data.copyright_p?.trim() || null,
      data.notes?.trim() || null,
      data.distribution_rights_confirmed === true,
    ] }];

    const contributors = cleanStringList(data.featured_artists);
    queries.push({
      text: 'DELETE FROM "ReleaseContributor" WHERE "releaseId" = $1 AND role = $2',
      values: [releaseId, 'featured_artist'],
    });
    contributors.forEach((name, index) => queries.push({
      text: 'INSERT INTO "ReleaseContributor" ("releaseId", role, name, position) VALUES ($1, $2, $3, $4)',
      values: [releaseId, 'featured_artist', name, index],
    }));

    for (const track of data.tracks || []) {
      queries.push({
        text: `INSERT INTO "Track" (
          "id", "releaseId", "title", "audioUrl", "isrc", "upc", "trackVersion", "primaryArtist",
          "featuredArtists", "composerNames", "songwriterNames", "producerNames", "arrangerNames",
          "trackNumber", "discNumber", "rightsOwnership", "distributionRightsConfirmed", genre, language,
          "explicitContent", "createdAt", "updatedAt"
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())`,
        values: [
          releaseId,
          track.title || data.title,
          track.audio_url || track.audioUrl || '',
          track.isrc || null,
          track.upc || null,
          track.track_version?.trim() || null,
          track.primary_artist?.trim() || artistName,
          cleanStringList(track.featured_artists),
          cleanStringList(track.composers),
          cleanStringList(track.songwriters),
          cleanStringList(track.producers),
          cleanStringList(track.arrangers),
          validPositiveInteger(track.track_number),
          validPositiveInteger(track.disc_number) || 1,
          track.rights_ownership?.trim() || null,
          track.distribution_rights_confirmed === true,
          track.genre?.trim() || data.genre || null,
          track.language?.trim() || data.language || null,
          track.explicit_content === true,
        ],
      });
    }

    if (!this.client.transaction) {
      throw new Error('Neon transaction support is required to create a release safely.');
    }
    const results = await this.client.transaction(queries);
    const createdRelease = results[0]?.rows[0];
    if (!createdRelease) throw new Error('Failed to create release');

    return transformNeonRelease(createdRelease, ownerId);
  }

  async updateRelease(releaseId: string, data: Partial<ReleaseInput>): Promise<Release> {
    if (!this.client.transaction) {
      throw new Error('Neon transaction support is required to update a release safely.');
    }
    const currentResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [releaseId]);
    if (!currentResult.rows.length) throw new NotFoundError(`Release ${releaseId} not found`);
    const current = currentResult.rows[0];

    const updates: string[] = [];
    const values: any[] = [releaseId];
    let paramIndex = 2;
    const fields: Array<[keyof ReleaseInput, string, unknown]> = [
      ['title', 'title', data.title?.trim()],
      ['upc', 'upc', data.upc?.trim() || null],
      ['genre', 'genre', data.genre?.trim() || null],
      ['language', 'language', data.language?.trim() || null],
      ['release_date', '"releaseDate"', data.release_date],
      ['release_version', '"releaseVersion"', data.release_version?.trim() || null],
      ['subgenre', 'subgenre', data.subgenre?.trim() || null],
      ['original_release_date', '"originalReleaseDate"', data.original_release_date || null],
      ['label_name', 'distributor', data.self_released ? 'Self-released' : data.label_name?.trim() || null],
      ['artwork_url', '"coverArtworkUrl"', data.artwork_url ?? data.cover_artwork_url],
      ['self_released', '"selfReleased"', data.self_released],
      ['copyright_c', '"copyrightC"', data.copyright_c?.trim() || null],
      ['copyright_p', '"copyrightP"', data.copyright_p?.trim() || null],
      ['notes', 'notes', data.notes?.trim() || null],
      ['distribution_rights_confirmed', '"distributionRightsConfirmed"', data.distribution_rights_confirmed],
    ];
    for (const [inputKey, column, value] of fields) {
      if (Object.prototype.hasOwnProperty.call(data, inputKey) && value !== undefined) {
        updates.push(`${column} = $${paramIndex++}`);
        values.push(value);
      }
    }
    if (data.release_type) {
      const type = data.release_type.toUpperCase();
      if (!['SINGLE', 'EP', 'ALBUM'].includes(type)) throw new ValidationError('Invalid release type.');
      updates.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    updates.push('"updatedAt" = NOW()');
    const pendingPredicate = `id = $1 AND status IN ('PENDING', 'REJECTED')`;
    const queries: Array<{ text: string; values?: unknown[] }> = [{
      text: `UPDATE "Release" SET ${updates.join(', ')} WHERE ${pendingPredicate} RETURNING *`,
      values,
    }];

    if (Array.isArray(data.featured_artists)) {
      queries.push({
        text: `DELETE FROM "ReleaseContributor" WHERE "releaseId" = $1 AND role = $2
          AND EXISTS (SELECT 1 FROM "Release" WHERE ${pendingPredicate})`,
        values: [releaseId, 'featured_artist'],
      });
      cleanStringList(data.featured_artists).forEach((name, index) => queries.push({
        text: `INSERT INTO "ReleaseContributor" ("releaseId", role, name, position)
          SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM "Release" WHERE ${pendingPredicate})`,
        values: [releaseId, 'featured_artist', name, index],
      }));
    }
    if (Array.isArray(data.tracks)) {
      const existing = await this.client.query(
        'SELECT id FROM "Track" WHERE "releaseId" = $1 ORDER BY "createdAt", id', [releaseId],
      );
      const artistResult = await this.client.query('SELECT "stageName" FROM "Artist" WHERE id = $1', [current.artistId]);
      const defaultArtist = artistResult.rows[0]?.stageName || '';
      for (let i = 0; i < data.tracks.length; i += 1) {
        const track = data.tracks[i];
        const existingId = track.id || existing.rows[i]?.id;
        if (existingId && !existing.rows.some((row) => row.id === existingId)) {
          throw new ValidationError('Track does not belong to this release.');
        }
        const parameters = [
          track.title?.trim() || current.title,
          track.audio_url ?? track.audioUrl ?? null,
          track.isrc?.trim() || null,
          track.upc?.trim() || null,
          track.track_version?.trim() || null,
          track.primary_artist?.trim() || defaultArtist,
          cleanStringList(track.featured_artists),
          cleanStringList(track.composers),
          cleanStringList(track.songwriters),
          cleanStringList(track.producers),
          cleanStringList(track.arrangers),
          validPositiveInteger(track.track_number),
          validPositiveInteger(track.disc_number) || 1,
          track.rights_ownership?.trim() || null,
          track.distribution_rights_confirmed === true,
          track.genre?.trim() || current.genre || null,
          track.language?.trim() || current.language || null,
          track.explicit_content === true,
        ];
        if (existingId) {
          queries.push({ text: `
            UPDATE "Track" SET title = $3, "audioUrl" = COALESCE($4, "audioUrl"), isrc = COALESCE($5, isrc), upc = COALESCE($6, upc),
              "trackVersion" = $7, "primaryArtist" = $8, "featuredArtists" = $9, "composerNames" = $10,
              "songwriterNames" = $11, "producerNames" = $12, "arrangerNames" = $13, "trackNumber" = $14,
              "discNumber" = $15, "rightsOwnership" = $16, "distributionRightsConfirmed" = $17,
              genre = $18, language = $19, "explicitContent" = $20, "updatedAt" = NOW()
            WHERE id = $1 AND "releaseId" = $2
              AND EXISTS (SELECT 1 FROM "Release" WHERE id = $2 AND status IN ('PENDING', 'REJECTED'))
          `, values: [existingId, releaseId, ...parameters] });
        } else {
          queries.push({ text: `
            INSERT INTO "Track" ("releaseId", title, "audioUrl", isrc, upc, "trackVersion", "primaryArtist", "featuredArtists",
              "composerNames", "songwriterNames", "producerNames", "arrangerNames", "trackNumber", "discNumber", "rightsOwnership",
              "distributionRightsConfirmed", genre, language, "explicitContent")
            SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            WHERE EXISTS (SELECT 1 FROM "Release" WHERE ${pendingPredicate})
          `, values: [releaseId, ...parameters] });
        }
      }
    }

    const results = await this.client.transaction(queries);
    const release = results[0]?.rows[0];
    if (!release) {
      const statusResult = await this.client.query('SELECT status FROM "Release" WHERE id = $1', [releaseId]);
      if (!statusResult.rows.length) throw new NotFoundError(`Release ${releaseId} not found`);
      throw new ValidationError('Release metadata can only be changed while the release is a draft or rejected.');
    }
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [release.artistId]);
    return this.enrichNeonRelease(release, artistResult.rows[0]?.userId || release.artistId);
  }

  async deleteRelease(releaseId: string): Promise<void> {
    const result = await this.client.query(
      'DELETE FROM "Release" WHERE id = $1 AND status IN (\'PENDING\', \'REJECTED\') RETURNING id',
      [releaseId],
    );
    if (!result.rows.length) {
      const status = await this.client.query('SELECT status FROM "Release" WHERE id = $1', [releaseId]);
      if (!status.rows.length) throw new NotFoundError(`Release ${releaseId} not found`);
      throw new ValidationError('Only draft or rejected releases can be deleted.');
    }
  }

  async getReleasByUpc(upc: string): Promise<Release | null> {
    const query = 'SELECT * FROM "Release" WHERE "upc" = $1';
    const result = await this.client.query(query, [upc]);

    if (result.rows.length === 0) return null;

    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [result.rows[0].artistId]);
    const ownerId = artistResult.rows[0]?.userId || result.rows[0].artistId;

    return transformNeonRelease(result.rows[0], ownerId);
  }

  // ========== TRACK OPERATIONS ==========

  async getTrack(trackId: string): Promise<Track | null> {
    const query = 'SELECT * FROM "Track" WHERE id = $1';
    const result = await this.client.query(query, [trackId]);

    if (result.rows.length === 0) return null;

    const track = result.rows[0];

    // Get release info for genre/language
    const releaseResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [track.releaseId]);
    const release = releaseResult.rows[0];

    // Get artist owner
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [release.artistId]);
    const ownerId = artistResult.rows[0]?.userId || release.artistId;

    return transformNeonTrack(track, ownerId, release?.genre, release?.language);
  }

  async listTracks(releaseId: string, limit: number = 50, offset: number = 0): Promise<{ data: Track[]; total: number }> {
    const countResult = await this.client.query('SELECT COUNT(*) FROM "Track" WHERE "releaseId" = $1', [releaseId]);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = 'SELECT * FROM "Track" WHERE "releaseId" = $1 LIMIT $2 OFFSET $3';
    const result = await this.client.query(query, [releaseId, limit, offset]);

    // Get release info
    const releaseResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [releaseId]);
    const release = releaseResult.rows[0];

    // Get artist owner
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [release.artistId]);
    const ownerId = artistResult.rows[0]?.userId || release.artistId;

    return {
      data: result.rows.map((row) => transformNeonTrack(row, ownerId, release?.genre, release?.language)),
      total,
    };
  }

  async createTrack(releaseId: string, ownerId: string, data: TrackInput): Promise<Track> {
    const query = `
      INSERT INTO "Track" ("id", "releaseId", "title", "audioUrl", "isrc", "upc", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

    const result = await this.client.query(query, [
      releaseId,
      data.title,
      data.audio_url || data.audioUrl || '',
      data.isrc || null,
      data.upc || null,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to create track');
    }

    const track = result.rows[0];

    // Get release for genre/language
    const releaseResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [releaseId]);
    const release = releaseResult.rows[0];

    return transformNeonTrack(track, ownerId, release?.genre, release?.language);
  }

  async updateTrack(trackId: string, data: Partial<TrackInput>): Promise<Track> {
    const updates: string[] = [];
    const values: any[] = [trackId];
    let paramIndex = 2;

    if (data.title) {
      updates.push(`"title" = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.isrc) {
      updates.push(`"isrc" = $${paramIndex++}`);
      values.push(data.isrc);
    }
    if (data.audio_url || data.audioUrl) {
      updates.push(`"audioUrl" = $${paramIndex++}`);
      values.push(data.audio_url || data.audioUrl);
    }

    updates.push(`"updatedAt" = NOW()`);

    const query = `UPDATE "Track" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.client.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Track ${trackId} not found`);
    }

    // Get release info
    const releaseResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [result.rows[0].releaseId]);
    const release = releaseResult.rows[0];

    // Get owner
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [release.artistId]);
    const ownerId = artistResult.rows[0]?.userId || release.artistId;

    return transformNeonTrack(result.rows[0], ownerId, release?.genre, release?.language);
  }

  async deleteTrack(trackId: string): Promise<void> {
    const query = 'DELETE FROM "Track" WHERE id = $1';
    await this.client.query(query, [trackId]);
  }

  async getTrackByIsrc(isrc: string): Promise<Track | null> {
    const query = 'SELECT * FROM "Track" WHERE "isrc" = $1';
    const result = await this.client.query(query, [isrc]);

    if (result.rows.length === 0) return null;

    const track = result.rows[0];

    // Get release
    const releaseResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [track.releaseId]);
    const release = releaseResult.rows[0];

    // Get owner
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [release.artistId]);
    const ownerId = artistResult.rows[0]?.userId || release.artistId;

    return transformNeonTrack(track, ownerId, release?.genre, release?.language);
  }

  async listTracksByIsrc(isrcList: string[]): Promise<Track[]> {
    if (isrcList.length === 0) return [];

    const placeholders = isrcList.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM "Track" WHERE "isrc" IN (${placeholders})`;
    const result = await this.client.query(query, isrcList);

    const tracks: Track[] = [];

    for (const track of result.rows) {
      const releaseResult = await this.client.query('SELECT * FROM "Release" WHERE id = $1', [track.releaseId]);
      const release = releaseResult.rows[0];

      const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [release.artistId]);
      const ownerId = artistResult.rows[0]?.userId || release.artistId;

      tracks.push(transformNeonTrack(track, ownerId, release?.genre, release?.language));
    }

    return tracks;
  }

  // ========== STREAMING OPERATIONS ==========

  async getStreamingRecords(filters: StreamingFilter): Promise<{ data: StreamingRecord[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      conditions.push(`${column} = $${params.length}`);
    };
    if (filters.owner_id) add('a."userId"', filters.owner_id);
    if (filters.artist_id) add('a.id', filters.artist_id);
    if (filters.release_id) add('r.id', filters.release_id);
    if (filters.track_id) add('t.id', filters.track_id);
    if (filters.platform) add('s.platform', filters.platform);
    if (filters.territory) add('s.country', filters.territory);
    if (filters.start_date) { params.push(filters.start_date); conditions.push(`s.date >= $${params.length}`); }
    if (filters.end_date) { params.push(filters.end_date); conditions.push(`s.date <= $${params.length}`); }

    const from = ` FROM "Streaming" s
      LEFT JOIN "Track" t ON t.id = s."trackId"
      LEFT JOIN "Release" r ON r.id = COALESCE(s."releaseId", t."releaseId")
      LEFT JOIN "Artist" a ON a.id = r."artistId"`;
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.client.query(`SELECT COUNT(*) AS total${from}${where}`, params);
    const limit = Math.min(filters.limit || 50, 500);
    const offset = filters.offset || 0;
    const result = await this.client.query(
      `SELECT s.*, t.isrc AS isrc, t.title AS "trackTitle", r.title AS "releaseTitle", a."stageName" AS "artistName", a."userId" AS "ownerId"${from}${where} ORDER BY s."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return {
      data: result.rows.map((row) => transformNeonStreaming(row, row.isrc)),
      total: Number(count.rows[0]?.total || 0),
    };
  }

  async hasStreamingDuplicate(sourceRowHash: string): Promise<boolean> {
    const result = await this.client.query(
      'SELECT EXISTS (SELECT 1 FROM "Streaming" WHERE "sourceRowHash" = $1) AS found',
      [sourceRowHash],
    );
    return result.rows[0]?.found === true;
  }

  async hasStreamingIdentityDuplicate(sourceRowIdentity: string): Promise<boolean> {
    const result = await this.client.query(
      'SELECT EXISTS (SELECT 1 FROM "Streaming" WHERE "sourceRowReference" = $1) AS found',
      [sourceRowIdentity],
    );
    return result.rows[0]?.found === true;
  }

  async getStreamingRecordsByImport(importId: string, limit: number, offset: number): Promise<StreamingRecord[]> {
    const result = await this.client.query(
      'SELECT * FROM "Streaming" WHERE "reportId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3',
      [importId, limit, offset],
    );
    return result.rows.map((row) => transformNeonStreaming(row));
  }

  async createStreamingRecord(data: StreamingRecord): Promise<StreamingRecord> {
    const query = `
      INSERT INTO "Streaming" ("id", "trackId", "releaseId", "reportId", "platform", "country", "playCount", "date", "revenue", "currency", "sourceRowHash", "grossRevenue", deductions, "netRevenue", "sourceRowReference", "periodStart", "periodEnd", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    const result = await this.client.query(query, [
      data.track_id,
      data.release_id,
      data.report_id,
      data.platform,
      data.territory,
      data.streams,
      data.reporting_period,
      data.revenue ?? null,
      data.currency || 'USD',
      data.source_row_hash || null,
      data.revenue ?? null,
      data.deductions ?? null,
      data.net_revenue ?? null,
      data.source_row_reference || null,
      data.report_period_start || null,
      data.report_period_end || null,
    ]);

    if (result.rows.length === 0) {
      throw new Error('DUPLICATE_SOURCE_ROW');
    }

    return transformNeonStreaming(result.rows[0], data.isrc);
  }

  async createStreamingRecords(data: StreamingRecord[]): Promise<StreamingRecord[]> {
    if (data.length === 0) return [];

    const records: StreamingRecord[] = [];

    for (const record of data) {
      const created = await this.createStreamingRecord(record);
      records.push(created);
    }

    return records;
  }

  async getStreamingByPeriod(artistId: string, startDate: string, endDate: string): Promise<StreamingRecord[]> {
    // Get all tracks for artist
    const tracksQuery = `
      SELECT t.id, t.isrc FROM "Track" t
      INNER JOIN "Release" r ON t."releaseId" = r.id
      INNER JOIN "Artist" a ON r."artistId" = a.id
      WHERE a."userId" = $1
    `;

    const tracksResult = await this.client.query(tracksQuery, [artistId]);

    if (tracksResult.rows.length === 0) return [];

    const trackIds = tracksResult.rows.map((r) => r.id);

    // Get streaming records for these tracks
    const placeholders = trackIds.map((_, i) => `$${i + 1}`).join(',');
    const streamingQuery = `
      SELECT * FROM "Streaming"
      WHERE "trackId" IN (${placeholders})
      AND date >= $${trackIds.length + 1}
      AND date <= $${trackIds.length + 2}
    `;

    const streamingResult = await this.client.query(streamingQuery, [...trackIds, startDate, endDate]);

    const trackIsrcMap = Object.fromEntries(tracksResult.rows.map((r) => [r.id, r.isrc]));

    return streamingResult.rows.map((row) => transformNeonStreaming(row, trackIsrcMap[row.trackId]));
  }

  // ========== ROYALTY OPERATIONS ==========

  async getRoyalties(artistId: string, limit: number = 50, offset: number = 0): Promise<{ data: RoyaltyEntry[]; total: number }> {
    const countResult = await this.client.query('SELECT COUNT(*) FROM "Royalty" WHERE "artistId" = $1', [artistId]);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = 'SELECT * FROM "Royalty" WHERE "artistId" = $1 LIMIT $2 OFFSET $3';
    const result = await this.client.query(query, [artistId, limit, offset]);

    // Attempt to match tracks by song name
    const royalties: RoyaltyEntry[] = [];
    for (const row of result.rows) {
      const trackResult = await this.client.query(
        `SELECT t.id FROM "Track" t
         JOIN "Release" r ON r.id = t."releaseId"
         WHERE r."artistId" = $1 AND LOWER(t.title) = LOWER($2)
         ORDER BY t.id LIMIT 2`,
        [artistId, row.songName],
      );
      // Legacy royalties are grouped by song name, so only link when the
      // title identifies exactly one track belonging to this artist.
      const trackId = trackResult.rows.length === 1 ? trackResult.rows[0].id : undefined;

      royalties.push(transformNeonRoyalty(row, trackId));
    }

    return { data: royalties, total };
  }

  async getRoyaltiesByPeriod(artistId: string, startDate: string, endDate: string): Promise<RoyaltyEntry[]> {
    // Parse dates to get year/month range
    const start = new Date(startDate);
    const end = new Date(endDate);

    const query = `
      SELECT * FROM "Royalty"
      WHERE "artistId" = $1
      AND (year > $2 OR (year = $2 AND month >= $3))
      AND (year < $4 OR (year = $4 AND month <= $5))
    `;

    const result = await this.client.query(query, [
      artistId,
      start.getFullYear(),
      start.getMonth() + 1,
      end.getFullYear(),
      end.getMonth() + 1,
    ]);

    const royalties: RoyaltyEntry[] = [];
    for (const row of result.rows) {
      royalties.push(transformNeonRoyalty(row));
    }

    return royalties;
  }

  async getRoyaltyTotal(artistId: string): Promise<number> {
    const query = 'SELECT SUM("totalRevenue") as total FROM "Royalty" WHERE "artistId" = $1';
    const result = await this.client.query(query, [artistId]);
    return result.rows[0]?.total || 0;
  }

  async getRoyaltyCalculationItemsForOwner(userId: string, limit = 100, offset = 0): Promise<{ data: any[]; total: number }> {
    const ownerPredicate = `FROM "RoyaltyCalculationItem" i
      JOIN "Track" t ON t.id = i."trackId"
      JOIN "Release" r ON r.id = i."releaseId" AND r.id = t."releaseId"
      JOIN "Artist" a ON a.id = i."artistId" AND a.id = r."artistId"
      JOIN "RoyaltyCalculationBatch" b ON b.id = i."batchId"
      WHERE a."userId" = $1 AND b.status = 'completed'`;
    const count = await this.client.query(`SELECT COUNT(*)::int AS total ${ownerPredicate}`, [userId]);
    const result = await this.client.query(`
      SELECT i.id, i."trackId", t.title AS "trackTitle", t.isrc,
        i."releaseId", r.title AS "releaseTitle", i."artistId", a."stageName" AS "artistName",
        i.platform, i."periodStart", i.streams, i."grossRevenue", i.deductions, i."netRevenue",
        i."sharePercent", i."royaltyAmount", i.currency, b.status AS "batchStatus", b."completedAt"
      ${ownerPredicate}
      ORDER BY i."periodStart" DESC, i."createdAt" DESC, i.id DESC
      LIMIT $2 OFFSET $3
    `, [userId, Math.min(Math.max(limit, 1), 500), Math.max(offset, 0)]);
    return {
      total: Number(count.rows[0]?.total || 0),
      data: result.rows.map((row) => ({
        id: row.id, track_id: row.trackId, track_title: row.trackTitle || '', isrc: row.isrc || '',
        release_id: row.releaseId, release_title: row.releaseTitle || '', artist_id: row.artistId,
        artist_name: row.artistName || '', platform: row.platform,
        period_start: row.periodStart instanceof Date ? row.periodStart.toISOString().slice(0, 10) : String(row.periodStart).slice(0, 10),
        streams: Number(row.streams), gross_revenue: Number(row.grossRevenue), deductions: Number(row.deductions),
        net_revenue: Number(row.netRevenue), share_percent: Number(row.sharePercent),
        amount: Number(row.royaltyAmount), currency: row.currency, status: row.batchStatus, completed_at: row.completedAt,
      })),
    };
  }

  async listRoyaltyRules(artistId?: string): Promise<any[]> {
    const result = await this.client.query(`
      SELECT rr.*, a."stageName" AS "artistName", u.full_name AS "createdByName"
      FROM "RoyaltyRule" rr
      JOIN "Artist" a ON a.id = rr."artistId"
      LEFT JOIN users u ON u.id = rr."createdBy"
      WHERE ($1::uuid IS NULL OR rr."artistId" = $1::uuid)
      ORDER BY rr."effectiveFrom" DESC, rr."createdAt" DESC
    `, [artistId || null]);
    return result.rows.map((row) => ({
      id: row.id, artist_id: row.artistId, artist_name: row.artistName || '', platform: row.platform,
      share_percent: Number(row.sharePercent), revenue_basis: row.revenueBasis, currency: row.currency,
      effective_from: row.effectiveFrom, effective_until: row.effectiveUntil || undefined,
      created_by: row.createdBy, created_by_name: row.createdByName || undefined, created_at: row.createdAt,
    }));
  }

  async createRoyaltyRule(data: RoyaltyRuleInput, adminId: string): Promise<any> {
    const result = await this.client.query(
      'SELECT (public.create_royalty_rule($1::uuid, $2, $3::numeric, $4, $5, $6::date, $7::date, $8::uuid)).*',
      [data.artist_id, data.platform, data.share_percent, data.revenue_basis, data.currency,
        data.effective_from, data.effective_until || null, adminId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Royalty rule was not created.');
    return {
      id: row.id, artist_id: row.artistId, platform: row.platform, share_percent: Number(row.sharePercent),
      revenue_basis: row.revenueBasis, currency: row.currency, effective_from: row.effectiveFrom,
      effective_until: row.effectiveUntil || undefined, created_by: row.createdBy, created_at: row.createdAt,
    };
  }

  async processStreamingReportRoyalties(reportId: string, adminId: string): Promise<string> {
    const result = await this.client.query(
      'SELECT public.process_streaming_report_royalties($1::uuid, $2::uuid) AS batch_id',
      [reportId, adminId],
    );
    const batchId = result.rows[0]?.batch_id;
    if (!batchId) throw new Error('Royalty processing returned no batch identifier.');
    return String(batchId);
  }

  async getFinancialLedger(userId?: string, limit = 100, offset = 0): Promise<{ data: any[]; total: number }> {
    const count = await this.client.query(
      'SELECT COUNT(*)::int AS total FROM "FinancialLedgerEntry" WHERE ($1::uuid IS NULL OR "userId" = $1::uuid)',
      [userId || null],
    );
    const result = await this.client.query(`
      SELECT l.*, u.email, u.full_name, a."stageName"
      FROM "FinancialLedgerEntry" l
      JOIN users u ON u.id = l."userId"
      LEFT JOIN "Artist" a ON a.id = l."artistId"
      WHERE ($1::uuid IS NULL OR l."userId" = $1::uuid)
      ORDER BY l."createdAt" DESC, l.id DESC LIMIT $2 OFFSET $3
    `, [userId || null, Math.min(Math.max(limit, 1), 500), Math.max(offset, 0)]);
    return {
      total: Number(count.rows[0]?.total || 0),
      data: result.rows.map((row) => ({
        id: row.id, user_id: row.userId, user_name: row.full_name || row.email,
        artist_name: row.stageName || undefined, entry_type: row.entryType, amount: Number(row.amount),
        currency: row.currency, reference_type: row.referenceType, reference_id: row.referenceId,
        description: row.description || '', metadata: row.metadata || {}, created_at: row.createdAt,
      })),
    };
  }

  async getFinancialLedgerSummary(userId: string): Promise<Array<{ currency: string; balance: number; total_earned: number; total_withdrawn: number }>> {
    const result = await this.client.query(`
      SELECT currency, COALESCE(SUM(amount), 0)::numeric AS balance,
        COALESCE(SUM(amount) FILTER (WHERE "entryType" IN ('royalty_credit', 'adjustment_credit')), 0)::numeric AS total_earned,
        COALESCE(-SUM(amount) FILTER (WHERE "entryType" = 'withdrawal_debit'), 0)::numeric AS total_withdrawn
      FROM "FinancialLedgerEntry" WHERE "userId" = $1 GROUP BY currency ORDER BY currency
    `, [userId]);
    return result.rows.map((row) => ({
      currency: row.currency, balance: Number(row.balance),
      total_earned: Number(row.total_earned), total_withdrawn: Number(row.total_withdrawn),
    }));
  }

  // ========== ADMIN OPERATIONS ==========

  async getAuditLogs(filters: any): Promise<{ data: any[]; total: number }> {
    let query = 'SELECT * FROM "AuditLog"';
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    const whereClauses: string[] = [];

    if (filters.action) {
      whereClauses.push(`"action" = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters.entity_type) {
      whereClauses.push(`"entityType" = $${paramIndex++}`);
      params.push(filters.entity_type);
    }
    if (filters.entity_id) {
      whereClauses.push(`"entityId" = $${paramIndex++}`);
      params.push(filters.entity_id);
    }
    if (filters.actor_id) {
      whereClauses.push(`"actorId" = $${paramIndex++}`);
      params.push(filters.actor_id);
    }
    if (filters.search) {
      whereClauses.push(`(action ILIKE $${paramIndex} OR "entityType" ILIKE $${paramIndex + 1})`);
      params.push(`%${filters.search}%`, `%${filters.search}%`);
      paramIndex += 2;
    }
    if (filters.start_date) {
      whereClauses.push(`"createdAt" >= $${paramIndex++}`);
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      whereClauses.push(`"createdAt" <= $${paramIndex++}`);
      params.push(filters.end_date);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Get total count
    const countResult = await this.client.query(`SELECT COUNT(*) FROM (${query}) AS count_query`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query += ` ORDER BY "createdAt" DESC LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`;

    const result = await this.client.query(query, [...params, limit, offset]);

    return {
      data: result.rows.map((row) => ({
        id: row.id,
        actor_id: row.actorId,
        action: row.action,
        entity_type: row.entityType,
        entity_id: row.entityId,
        metadata: row.metadata,
        created_at: row.createdAt,
      })),
      total,
    };
  }

  async createAuditLog(data: any): Promise<any> {
    const query = `
      INSERT INTO "AuditLog" ("actorId", "action", "entityType", "entityId", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await this.client.query(query, [
      data.actor_id || null,
      data.action,
      data.entity_type,
      data.entity_id || null,
      JSON.stringify(data.metadata || {}),
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to create audit log');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      actor_id: row.actorId,
      action: row.action,
      entity_type: row.entityType,
      entity_id: row.entityId,
      metadata: row.metadata,
      created_at: row.createdAt,
    };
  }

  async getWithdrawals(filters?: any): Promise<{ data: any[]; total: number }> {
    let query = 'SELECT w.*, u.full_name AS "userName" FROM "Withdrawal" w JOIN users u ON u.id = w."userId"';
    const params: any[] = [];
    let paramIndex = 1;

    const whereClauses: string[] = [];

    if (filters?.status) {
      whereClauses.push(`w."status" = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.owner_id) {
      whereClauses.push(`w."userId" = $${paramIndex++}`);
      params.push(filters.owner_id);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Get total count
    const countResult = await this.client.query(`SELECT COUNT(*) FROM (${query}) AS count_query`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query += ` ORDER BY w."createdAt" DESC LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`;

    const result = await this.client.query(query, [...params, limit, offset]);

    return {
      data: result.rows.map((row) => ({
        id: row.id,
        owner_id: row.userId,
        user_name: row.userName,
        amount: parseFloat(row.amount),
        currency: row.currency,
        payout_method: row.payoutMethod,
        payout_reference: row.payoutReference,
        status: row.status,
        reviewed_by: row.reviewedBy,
        reviewed_at: row.reviewedAt,
        paid_at: row.paidAt,
        rejection_reason: row.rejectionReason,
        reference_no: row.transferReference,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      })),
      total,
    };
  }

  async createWithdrawal(data: Pick<Withdrawal, 'owner_id' | 'amount' | 'currency' | 'payout_method' | 'payout_reference'>): Promise<Withdrawal> {
    const result = await this.client.query(
      `WITH locked_user AS MATERIALIZED (
         SELECT id FROM users WHERE id = $1 FOR UPDATE
       ), available AS MATERIALIZED (
         SELECT COALESCE(SUM(l.amount), 0) AS balance
         FROM "FinancialLedgerEntry" l WHERE l."userId" = (SELECT id FROM locked_user) AND l.currency = $3
       ), created AS (
         INSERT INTO "Withdrawal" ("userId", amount, currency, "payoutMethod", "payoutReference")
         SELECT $1, $2, $3, $4, $5 FROM locked_user, available WHERE $2::numeric <= available.balance
         RETURNING *
       ), reserved AS (
         INSERT INTO "FinancialLedgerEntry" ("userId", "entryType", amount, currency, "referenceType", "referenceId",
           "idempotencyKey", description, "createdBy")
         SELECT created."userId", 'withdrawal_reserve', -created.amount, created.currency, 'withdrawal', created.id,
           'withdrawal:' || created.id::text || ':reserve', 'Withdrawal request reserve', created."userId"
         FROM created ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING id
       )
       SELECT * FROM created`,
      [data.owner_id, data.amount, data.currency, data.payout_method, data.payout_reference || null],
    );
    const row = result.rows[0];
    if (!row) throw new ValidationError('Withdrawal amount exceeds the available royalty balance');
    return {
      id: row.id, owner_id: row.userId, amount: Number(row.amount), currency: row.currency,
      payout_method: row.payoutMethod, payout_reference: row.payoutReference || undefined,
      status: row.status, reviewed_by: row.reviewedBy || undefined, reviewed_at: row.reviewedAt || undefined,
      paid_at: row.paidAt || undefined, rejection_reason: row.rejectionReason || undefined,
      created_at: row.createdAt, updated_at: row.updatedAt,
    };
  }

  async updateWithdrawalStatus(
    withdrawalId: string,
    status: string,
    reason?: string,
    reviewedBy?: string
  ): Promise<any> {
    const query = `
      WITH prior AS MATERIALIZED (
        SELECT * FROM "Withdrawal" WHERE id = $4 FOR UPDATE
      ), changed AS (
        UPDATE "Withdrawal" w
        SET "status" = $1,
            "rejectionReason" = CASE WHEN $1 = 'rejected' THEN NULLIF(BTRIM($2), '') ELSE NULL END,
            "transferReference" = CASE WHEN $1 = 'paid' THEN NULLIF(BTRIM($2), '') ELSE w."transferReference" END,
            "reviewedBy" = $3::uuid, "reviewedAt" = NOW(),
            "paidAt" = CASE WHEN $1 = 'paid' THEN NOW() ELSE w."paidAt" END, "updatedAt" = NOW()
        FROM prior p WHERE w.id = p.id AND (
          ($1 IN ('approved', 'rejected') AND p.status IN ('pending', 'under_review'))
          OR ($1 = 'paid' AND p.status IN ('approved', 'processing'))
          OR ($1 = 'rejected' AND p.status IN ('approved', 'processing'))
        )
        RETURNING w.*
      ), ledger_lines AS (
        SELECT c."userId", 'withdrawal_release'::text AS "entryType", c.amount AS amount, c.currency, c.id AS "referenceId",
          'withdrawal:' || c.id::text || ':release' AS "idempotencyKey", $3::uuid AS "createdBy"
        FROM changed c WHERE c.status = 'rejected'
        UNION ALL
        SELECT c."userId", 'withdrawal_release', c.amount, c.currency, c.id,
          'withdrawal:' || c.id::text || ':release', $3::uuid
        FROM changed c WHERE c.status = 'paid'
        UNION ALL
        SELECT c."userId", 'withdrawal_debit', -c.amount, c.currency, c.id,
          'withdrawal:' || c.id::text || ':debit', $3::uuid
        FROM changed c WHERE c.status = 'paid'
      ), ledger AS (
        INSERT INTO "FinancialLedgerEntry" ("userId", "entryType", amount, currency, "referenceType", "referenceId",
          "idempotencyKey", description, "createdBy")
        SELECT "userId", "entryType", amount, currency, 'withdrawal', "referenceId", "idempotencyKey",
          'Withdrawal status settlement', "createdBy" FROM ledger_lines
        ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING id
      ), audit AS (
        INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", metadata)
        SELECT $3::uuid, 'withdrawal.status_changed', 'withdrawal', id,
          jsonb_build_object('status', status, 'reason', $2) FROM changed RETURNING "entityId"
      )
      SELECT changed.* FROM changed`;

    const result = await this.client.query(query, [status, reason || null, reviewedBy || null, withdrawalId]);

    if (result.rows.length === 0) {
      const prior = await this.client.query('SELECT status FROM "Withdrawal" WHERE id = $1', [withdrawalId]);
      if (prior.rows.length === 0) throw new NotFoundError(`Withdrawal ${withdrawalId} not found`);
      throw new ValidationError(`Withdrawal cannot transition from ${prior.rows[0].status} to ${status}`);
    }

    const row = result.rows[0];
    return {
      id: row.id,
      owner_id: row.userId,
      amount: parseFloat(row.amount),
      currency: row.currency,
      payout_method: row.payoutMethod,
      payout_reference: row.payoutReference,
      status: row.status,
      reviewed_by: row.reviewedBy,
      reviewed_at: row.reviewedAt,
      paid_at: row.paidAt,
      rejection_reason: row.rejectionReason,
      reference_no: row.transferReference,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  async listNotifications(userId: string, limit: number, offset: number): Promise<{ data: NotificationRecord[]; total: number }> {
    const [count, result] = await Promise.all([
      this.client.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1', [userId]),
      this.client.query(
        `SELECT id, user_id, notification_type, title, message, read_at, created_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
    ]);
    return {
      total: Number(count.rows[0]?.total || 0),
      data: result.rows.map((row) => ({
        id: row.id, user_id: row.user_id, type: row.notification_type, title: row.title,
        message: row.message, read: Boolean(row.read_at), created_at: row.created_at,
      })),
    };
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await this.client.query(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId],
    );
    return Number(result.rows[0]?.total || 0);
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.client.query(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId],
    );
    if (!result.rows.length) throw new NotFoundError('Notification not found');
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.client.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1', [userId]);
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const result = await this.client.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id', [notificationId, userId]);
    if (!result.rows.length) throw new NotFoundError('Notification not found');
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await this.client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
  }

  async getReleasesByStatus(status: string, limit: number = 50, offset: number = 0): Promise<{ data: any[]; total: number }> {
    const s = (status || 'ALL').toUpperCase();
    let countQuery = 'SELECT COUNT(*) FROM "Release"';
    let selectQuery = 'SELECT * FROM "Release"';
    let queryParams: any[] = [];

    if (s === 'ALL') {
      // Return all releases across the platform
      countQuery = 'SELECT COUNT(*) FROM "Release"';
      selectQuery = 'SELECT * FROM "Release" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2';
      queryParams = [limit, offset];
    } else if (s === 'REVIEW' || s === 'SUBMITTED' || s === 'IN_REVIEW') {
      // Include both REVIEW and PENDING submissions for admin review queue
      countQuery = 'SELECT COUNT(*) FROM "Release" WHERE "status" IN (\'REVIEW\', \'PENDING\')';
      selectQuery = 'SELECT * FROM "Release" WHERE "status" IN (\'REVIEW\', \'PENDING\') ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2';
      queryParams = [limit, offset];
    } else {
      countQuery = 'SELECT COUNT(*) FROM "Release" WHERE "status" = $1';
      selectQuery = 'SELECT * FROM "Release" WHERE "status" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3';
      queryParams = [s, limit, offset];
    }

    const countResult = await this.client.query(
      countQuery,
      s === 'ALL' || s === 'REVIEW' || s === 'SUBMITTED' || s === 'IN_REVIEW' ? [] : [s]
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const result = await this.client.query(selectQuery, queryParams);

    const releases = await Promise.all(
      result.rows.map((row) => this.enrichNeonRelease(row))
    );

    return { data: releases, total };
  }

  async updateReleaseStatus(
    releaseId: string,
    newStatus: string,
    reason?: string,
    actorId?: string
  ): Promise<any> {
    const normalized = newStatus.toUpperCase();
    if (!['REVIEW', 'APPROVED', 'REJECTED'].includes(normalized)) {
      throw new ValidationError('Unsupported release status transition.');
    }
    if (normalized === 'REJECTED' && !reason?.trim()) {
      throw new ValidationError('A rejection reason is required.');
    }
    const result = await this.client.query(`
      WITH prior AS MATERIALIZED (
        SELECT id, status FROM "Release" WHERE id = $1 FOR UPDATE
      ), allowed AS (
        SELECT id, status FROM prior
        WHERE ($2 = 'REVIEW' AND status IN ('PENDING', 'REJECTED'))
           OR ($2 IN ('APPROVED', 'REJECTED') AND status = 'REVIEW')
      ), changed AS (
        UPDATE "Release" AS r
        SET status = $2,
            "rejectionReason" = CASE WHEN $2 = 'REJECTED' THEN NULLIF(BTRIM($3), '') ELSE NULL END,
            "reviewedBy" = CASE WHEN $2 IN ('APPROVED', 'REJECTED') THEN $4::uuid ELSE r."reviewedBy" END,
            "reviewedAt" = CASE WHEN $2 IN ('APPROVED', 'REJECTED') THEN NOW() ELSE r."reviewedAt" END,
            "updatedAt" = NOW()
        FROM allowed p WHERE r.id = p.id
        RETURNING r.*, p.status AS "previousStatus"
      ), history AS (
        INSERT INTO "ReleaseStatusHistory" ("releaseId", "previousStatus", "newStatus", reason, "actorId", "createdAt")
        SELECT id, "previousStatus", status, NULLIF(BTRIM($3), ''), $4::uuid, NOW() FROM changed
        RETURNING "releaseId"
      ), audit AS (
        INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", metadata, "createdAt")
        SELECT $4::uuid, 'release.status_changed', 'release', id,
          jsonb_build_object('previousStatus', "previousStatus", 'status', status, 'reason', NULLIF(BTRIM($3), '')), NOW()
        FROM changed
        RETURNING "entityId"
      )
      SELECT changed.* FROM changed
      JOIN history ON history."releaseId" = changed.id
      JOIN audit ON audit."entityId" = changed.id
    `, [releaseId, normalized, reason || null, actorId || null]);
    if (!result.rows.length) {
      const current = await this.client.query('SELECT status FROM "Release" WHERE id = $1', [releaseId]);
      if (!current.rows.length) throw new NotFoundError(`Release ${releaseId} not found`);
      throw new ValidationError(`Cannot change release status from ${current.rows[0].status} to ${normalized}.`);
    }

    const row = result.rows[0];
    const artistResult = await this.client.query('SELECT "userId" FROM "Artist" WHERE id = $1', [row.artistId]);
    const ownerId = artistResult.rows[0]?.userId || row.artistId;

    return this.enrichNeonRelease(row, ownerId);
  }

  async getReleaseStatusHistory(releaseId: string) {
    const result = await this.client.query(`
      SELECT h."previousStatus", h."newStatus", h.reason, h."actorId", u.full_name AS "actorName", h."createdAt"
      FROM "ReleaseStatusHistory" h
      LEFT JOIN users u ON u.id = h."actorId"
      WHERE h."releaseId" = $1 ORDER BY h."createdAt" DESC, h.id DESC
    `, [releaseId]);
    return result.rows.map((row) => ({
      previous_status: row.previousStatus || undefined,
      new_status: row.newStatus,
      reason: row.reason || undefined,
      actor_id: row.actorId || undefined,
      actor_name: row.actorName || undefined,
      created_at: row.createdAt,
    }));
  }

  async createCsvImport(data: any): Promise<any> {
    const query = `
      INSERT INTO "CsvImport" ("uploadedBy", "source", "filename", "fileHash", "status", "totalRows", "validRows", "invalidRows", "duplicateRows", "reportIdentifier", "periodStart", "periodEnd", currency, "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `;

    const result = await this.client.query(query, [
      data.uploaded_by,
      data.source,
      data.filename,
      data.file_hash || null,
      data.status || 'pending',
      data.total_rows || 0,
      data.valid_rows || 0,
      data.invalid_rows || 0,
      data.duplicate_rows || 0,
      data.report_identifier || null,
      data.period_start || null,
      data.period_end || null,
      data.currency ?? null,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to create CSV import');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      uploaded_by: row.uploadedBy,
      source: row.source,
      filename: row.filename,
      file_hash: row.fileHash,
      status: row.status,
      total_rows: row.totalRows,
      valid_rows: row.validRows,
      invalid_rows: row.invalidRows,
      duplicate_rows: row.duplicateRows,
      report_identifier: row.reportIdentifier || undefined,
      period_start: row.periodStart || undefined,
      period_end: row.periodEnd || undefined,
      currency: row.currency || 'USD',
      created_at: row.createdAt,
      completed_at: row.completedAt,
    };
  }

  async getCsvImportStatus(importId: string): Promise<any | null> {
    const query = 'SELECT * FROM "CsvImport" WHERE id = $1';
    const result = await this.client.query(query, [importId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      uploaded_by: row.uploadedBy,
      source: row.source,
      filename: row.filename,
      file_hash: row.fileHash,
      status: row.status,
      total_rows: row.totalRows,
      valid_rows: row.validRows,
      invalid_rows: row.invalidRows,
      duplicate_rows: row.duplicateRows,
      report_identifier: row.reportIdentifier || undefined,
      period_start: row.periodStart || undefined,
      period_end: row.periodEnd || undefined,
      currency: row.currency || 'USD',
      created_at: row.createdAt,
      completed_at: row.completedAt,
    };
  }

  async updateCsvImport(importId: string, data: { status?: string; valid_rows?: number; invalid_rows?: number; duplicate_rows?: number; completed_at?: string }): Promise<void> {
    await this.client.query(
      `UPDATE "CsvImport" SET
        "status" = COALESCE($2, "status"),
        "validRows" = COALESCE($3, "validRows"),
        "invalidRows" = COALESCE($4, "invalidRows"),
        "duplicateRows" = COALESCE($5, "duplicateRows"),
        "completedAt" = COALESCE($6::timestamptz, "completedAt")
       WHERE id = $1`,
      [importId, data.status || null, data.valid_rows ?? null, data.invalid_rows ?? null,
        data.duplicate_rows ?? null, data.completed_at || null],
    );
  }

  async createCsvImportErrors(importId: string, errors: Array<{ row_number: number; error_code: string; error_message: string; raw_row?: string }>): Promise<void> {
    for (const item of errors) {
      await this.client.query(
        `INSERT INTO "CsvImportError" ("importId", "rowNumber", "errorCode", "errorMessage", "rawRow")
         VALUES ($1, $2, $3, $4, $5)`,
        [importId, item.row_number, item.error_code, item.error_message, item.raw_row || ''],
      );
    }
  }

  async getCsvImportErrors(importId: string, limit: number, offset: number) {
    const result = await this.client.query(
      `SELECT "rowNumber" AS row_number, "errorCode" AS error_code,
              "errorMessage" AS error_message, "rawRow" AS raw_row
       FROM "CsvImportError" WHERE "importId" = $1 ORDER BY "rowNumber" LIMIT $2 OFFSET $3`,
      [importId, limit, offset],
    );
    return result.rows;
  }

  async listCsvImports(filters: { source?: string; status?: string; start_date?: string; end_date?: string; limit: number; offset: number }) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); clauses.push(sql.replace('?', `$${params.length}`)); };
    if (filters.source) add('ci."source" = ?', filters.source);
    if (filters.status) add('ci."status" = ?', filters.status);
    if (filters.start_date) add('ci."createdAt" >= ?', filters.start_date);
    if (filters.end_date) add('ci."createdAt" <= ?', filters.end_date);
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const from = ' FROM "CsvImport" ci JOIN users u ON u.id = ci."uploadedBy"';
    const count = await this.client.query(`SELECT COUNT(*) AS total${from}${where}`, params);
    const queryParams = [...params, filters.limit, filters.offset];
    const rows = await this.client.query(
      `SELECT ci.*, u.full_name AS "uploadedByName"${from}${where} ORDER BY ci."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams,
    );
    return {
      data: rows.rows.map((row) => ({
        id: row.id, uploaded_by: row.uploadedByName, source: row.source, filename: row.filename,
        file_hash: row.fileHash, status: row.status, total_rows: row.totalRows,
        valid_rows: row.validRows, invalid_rows: row.invalidRows, duplicate_rows: row.duplicateRows,
        report_identifier: row.reportIdentifier || undefined, period_start: row.periodStart || undefined,
        period_end: row.periodEnd || undefined, currency: row.currency || 'USD',
        created_at: row.createdAt, completed_at: row.completedAt,
      })),
      total: Number(count.rows[0]?.total || 0),
    };
  }

  // ========== CMS OPERATIONS ==========

  async initCmsTables(): Promise<void> {
    // CMS schema is managed only by versioned migrations; no runtime DDL or seed data.
  }

  // ========== PUBLIC LANDING DATA ==========

  async getLandingContent(): Promise<{
    sections: CmsLandingSection[];
    testimonials: CmsTestimonial[];
    faq_categories: CmsFaqCategory[];
    scrollytelling?: CmsScrollytelling | null;
  }> {
    await this.initCmsTables();

    const sectionsRes = await this.client.query(
      'SELECT * FROM cms_landing_sections WHERE is_enabled = true ORDER BY sort_order ASC'
    );
    const testimonialsRes = await this.client.query(
      "SELECT * FROM cms_testimonials WHERE status = 'published' ORDER BY sort_order ASC"
    );
    const categoriesRes = await this.client.query(
      "SELECT * FROM cms_faq_categories WHERE status = 'published' ORDER BY sort_order ASC"
    );
    const itemsRes = await this.client.query(
      "SELECT * FROM cms_faq_items WHERE status = 'published' ORDER BY sort_order ASC"
    );

    const categories: CmsFaqCategory[] = categoriesRes.rows.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sort_order: c.sort_order ?? 0,
      display_order: c.sort_order ?? 0,
      status: c.status,
      items: itemsRes.rows
        .filter((it: any) => it.category_id === c.id)
        .map((it: any) => ({
          ...it,
          sort_order: it.sort_order ?? 0,
          display_order: it.sort_order ?? 0,
        })),
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    const scrollytelling = await this.getScrollytelling(true);

    return {
      sections: sectionsRes.rows.map((s: any) => ({
        ...s,
        sort_order: s.sort_order ?? 0,
        display_order: s.sort_order ?? 0,
      })),
      testimonials: testimonialsRes.rows.map((t: any) => ({
        ...t,
        sort_order: t.sort_order ?? 0,
        display_order: t.sort_order ?? 0,
      })),
      faq_categories: categories,
      scrollytelling,
    };
  }

  // ========== TESTIMONIALS CRUD ==========

  async listCmsTestimonials(publishedOnly = false): Promise<CmsTestimonial[]> {
    await this.initCmsTables();
    let query = 'SELECT * FROM cms_testimonials';
    if (publishedOnly) {
      query += " WHERE status = 'published'";
    }
    query += ' ORDER BY sort_order ASC, created_at DESC';
    const res = await this.client.query(query);
    return res.rows.map((r: any) => ({
      ...r,
      sort_order: r.sort_order ?? 0,
      display_order: r.sort_order ?? 0,
    }));
  }

  async createCmsTestimonial(data: Partial<CmsTestimonial>): Promise<CmsTestimonial> {
    await this.initCmsTables();
    const id = data.id || `test-${Date.now()}`;
    const artistName = data.artist_name || 'Artis';
    const avatarUrl = data.avatar_url || '';
    const roleLabel = data.role_label || 'Musisi';
    const quote = data.quote || '';
    const sortOrder = data.sort_order ?? (data as any).display_order ?? 0;
    const status = data.status || 'published';

    const res = await this.client.query(
      `INSERT INTO cms_testimonials (id, artist_name, avatar_url, role_label, quote, sort_order, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [id, artistName, avatarUrl, roleLabel, quote, sortOrder, status]
    );
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0 };
  }

  async updateCmsTestimonial(id: string, data: Partial<CmsTestimonial>): Promise<CmsTestimonial> {
    await this.initCmsTables();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.artist_name !== undefined) {
      fields.push(`artist_name = $${idx++}`);
      values.push(data.artist_name);
    }
    if (data.avatar_url !== undefined) {
      fields.push(`avatar_url = $${idx++}`);
      values.push(data.avatar_url);
    }
    if (data.role_label !== undefined) {
      fields.push(`role_label = $${idx++}`);
      values.push(data.role_label);
    }
    if (data.quote !== undefined) {
      fields.push(`quote = $${idx++}`);
      values.push(data.quote);
    }
    const sortVal = data.sort_order !== undefined ? data.sort_order : (data as any).display_order;
    if (sortVal !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(sortVal);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE cms_testimonials SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.client.query(query, values);
    if (res.rows.length === 0) throw new NotFoundError('Testimonial not found');
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0 };
  }

  async deleteCmsTestimonial(id: string): Promise<void> {
    await this.initCmsTables();
    await this.client.query('DELETE FROM cms_testimonials WHERE id = $1', [id]);
  }

  // ========== FAQ CATEGORIES & ITEMS CRUD ==========

  async listCmsFaqCategories(publishedOnly = false): Promise<CmsFaqCategory[]> {
    await this.initCmsTables();
    let query = 'SELECT * FROM cms_faq_categories';
    if (publishedOnly) {
      query += " WHERE status = 'published'";
    }
    query += ' ORDER BY sort_order ASC, created_at ASC';
    const catRes = await this.client.query(query);

    let itemQuery = 'SELECT * FROM cms_faq_items';
    if (publishedOnly) {
      itemQuery += " WHERE status = 'published'";
    }
    itemQuery += ' ORDER BY sort_order ASC, created_at ASC';
    const itemRes = await this.client.query(itemQuery);

    return catRes.rows.map((c: any) => ({
      ...c,
      sort_order: c.sort_order ?? 0,
      display_order: c.sort_order ?? 0,
      items: itemRes.rows
        .filter((it: any) => it.category_id === c.id)
        .map((it: any) => ({
          ...it,
          sort_order: it.sort_order ?? 0,
          display_order: it.sort_order ?? 0,
        })),
    }));
  }

  async createCmsFaqCategory(data: Partial<CmsFaqCategory>): Promise<CmsFaqCategory> {
    await this.initCmsTables();
    const id = data.id || `cat-${Date.now()}`;
    const name = data.name || 'Kategori FAQ Baru';
    const slug = data.slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const description = data.description || '';
    const sortOrder = data.sort_order ?? (data as any).display_order ?? 0;
    const status = data.status || 'published';

    const res = await this.client.query(
      `INSERT INTO cms_faq_categories (id, name, slug, description, sort_order, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, name, slug, description, sortOrder, status]
    );
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0, items: [] };
  }

  async updateCmsFaqCategory(id: string, data: Partial<CmsFaqCategory>): Promise<CmsFaqCategory> {
    await this.initCmsTables();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${idx++}`);
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }
    const sortVal = data.sort_order !== undefined ? data.sort_order : (data as any).display_order;
    if (sortVal !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(sortVal);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE cms_faq_categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.client.query(query, values);
    if (res.rows.length === 0) throw new NotFoundError('FAQ Category not found');
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0 };
  }

  async deleteCmsFaqCategory(id: string): Promise<void> {
    await this.initCmsTables();
    await this.client.query('DELETE FROM cms_faq_items WHERE category_id = $1', [id]);
    await this.client.query('DELETE FROM cms_faq_categories WHERE id = $1', [id]);
  }

  async listCmsFaqItems(categoryId?: string, publishedOnly = false): Promise<CmsFaqItem[]> {
    await this.initCmsTables();
    let query = 'SELECT * FROM cms_faq_items WHERE 1=1';
    const values: any[] = [];
    let idx = 1;

    if (categoryId) {
      query += ` AND category_id = $${idx++}`;
      values.push(categoryId);
    }
    if (publishedOnly) {
      query += ` AND status = 'published'`;
    }
    query += ' ORDER BY sort_order ASC, created_at ASC';
    const res = await this.client.query(query, values);
    return res.rows.map((r: any) => ({
      ...r,
      sort_order: r.sort_order ?? 0,
      display_order: r.sort_order ?? 0,
    }));
  }

  async createCmsFaqItem(data: Partial<CmsFaqItem>): Promise<CmsFaqItem> {
    await this.initCmsTables();
    const id = data.id || `faq-${Date.now()}`;
    const categoryId = data.category_id || '';
    const question = data.question || '';
    const answer = data.answer || '';
    const sortOrder = data.sort_order ?? (data as any).display_order ?? 0;
    const status = data.status || 'published';

    const res = await this.client.query(
      `INSERT INTO cms_faq_items (id, category_id, question, answer, sort_order, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [id, categoryId, question, answer, sortOrder, status]
    );
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0 };
  }

  async updateCmsFaqItem(id: string, data: Partial<CmsFaqItem>): Promise<CmsFaqItem> {
    await this.initCmsTables();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.category_id !== undefined) {
      fields.push(`category_id = $${idx++}`);
      values.push(data.category_id);
    }
    if (data.question !== undefined) {
      fields.push(`question = $${idx++}`);
      values.push(data.question);
    }
    if (data.answer !== undefined) {
      fields.push(`answer = $${idx++}`);
      values.push(data.answer);
    }
    const sortVal = data.sort_order !== undefined ? data.sort_order : (data as any).display_order;
    if (sortVal !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(sortVal);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE cms_faq_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.client.query(query, values);
    if (res.rows.length === 0) throw new NotFoundError('FAQ item not found');
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0 };
  }

  async deleteCmsFaqItem(id: string): Promise<void> {
    await this.initCmsTables();
    await this.client.query('DELETE FROM cms_faq_items WHERE id = $1', [id]);
  }

  // ========== SECTIONS CRUD ==========

  async listCmsSections(enabledOnly = false): Promise<CmsLandingSection[]> {
    await this.initCmsTables();
    let query = 'SELECT * FROM cms_landing_sections';
    if (enabledOnly) {
      query += ' WHERE is_enabled = true';
    }
    query += ' ORDER BY sort_order ASC';
    const res = await this.client.query(query);
    return res.rows.map((r: any) => ({
      ...r,
      sort_order: r.sort_order ?? 0,
      display_order: r.sort_order ?? 0,
    }));
  }

  async updateCmsSection(id: string, data: Partial<CmsLandingSection>): Promise<CmsLandingSection> {
    await this.initCmsTables();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (data.subtitle !== undefined) {
      fields.push(`subtitle = $${idx++}`);
      values.push(data.subtitle);
    }
    const sortVal = data.sort_order !== undefined ? data.sort_order : (data as any).display_order;
    if (sortVal !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(sortVal);
    }
    if (data.is_enabled !== undefined) {
      fields.push(`is_enabled = $${idx++}`);
      values.push(data.is_enabled);
    }
    if (data.content_json !== undefined) {
      fields.push(`content_json = $${idx++}`);
      values.push(data.content_json);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE cms_landing_sections SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.client.query(query, values);
    if (res.rows.length === 0) throw new NotFoundError('Section not found');
    const r = res.rows[0];
    return { ...r, sort_order: r.sort_order ?? 0, display_order: r.sort_order ?? 0 };
  }

  // ========== SCROLLYTELLING ANIMATION CRUD ==========

  async getScrollytelling(publishedOnly = false): Promise<CmsScrollytelling | null> {
    await this.initCmsTables();
    let query = 'SELECT * FROM cms_scrollytelling WHERE id = $1';
    if (publishedOnly) {
      query += " AND status = 'published' AND is_enabled = true";
    }
    const res = await this.client.query(query, ['main']);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    const framesRes = await this.client.query(
      'SELECT * FROM cms_scrollytelling_frames WHERE scrollytelling_id = $1 ORDER BY frame_index ASC',
      ['main']
    );

    let textSteps: CmsScrollytellingStep[] = [];
    if (row.text_steps) {
      textSteps = typeof row.text_steps === 'string' ? JSON.parse(row.text_steps) : row.text_steps;
    }

    return {
      id: row.id,
      is_enabled: row.is_enabled,
      status: row.status,
      bg_color: row.bg_color || '#0B0B0E',
      scroll_height_vh: row.scroll_height_vh || 400,
      canvas_aspect_ratio: row.canvas_aspect_ratio || '16/9',
      cta_label: row.cta_label || 'Mulai Rilis Lagu Gratis',
      cta_url: row.cta_url || '/register',
      text_steps: textSteps,
      frames: framesRes.rows.map((f: any) => ({
        id: f.id,
        scrollytelling_id: f.scrollytelling_id,
        frame_index: f.frame_index,
        frame_url: f.frame_url,
        created_at: f.created_at,
      })),
      updated_at: row.updated_at,
    };
  }

  async updateScrollytelling(data: Partial<CmsScrollytelling>): Promise<CmsScrollytelling> {
    await this.initCmsTables();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.is_enabled !== undefined) {
      fields.push(`is_enabled = $${idx++}`);
      values.push(data.is_enabled);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.bg_color !== undefined) {
      fields.push(`bg_color = $${idx++}`);
      values.push(data.bg_color);
    }
    if (data.scroll_height_vh !== undefined) {
      fields.push(`scroll_height_vh = $${idx++}`);
      values.push(data.scroll_height_vh);
    }
    if (data.canvas_aspect_ratio !== undefined) {
      fields.push(`canvas_aspect_ratio = $${idx++}`);
      values.push(data.canvas_aspect_ratio);
    }
    if (data.cta_label !== undefined) {
      fields.push(`cta_label = $${idx++}`);
      values.push(data.cta_label);
    }
    if (data.cta_url !== undefined) {
      fields.push(`cta_url = $${idx++}`);
      values.push(data.cta_url);
    }
    if (data.text_steps !== undefined) {
      fields.push(`text_steps = $${idx++}`);
      values.push(JSON.stringify(data.text_steps));
    }
    fields.push(`updated_at = NOW()`);
    values.push('main');

    const query = `UPDATE cms_scrollytelling SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    await this.client.query(query, values);

    const updated = await this.getScrollytelling(false);
    if (!updated) throw new NotFoundError('Scrollytelling configuration not found');
    return updated;
  }

  async addScrollytellingFrame(frameUrl: string, frameIndex?: number): Promise<CmsScrollytellingFrame> {
    await this.initCmsTables();
    let index = frameIndex;
    if (index === undefined) {
      const maxRes = await this.client.query(
        'SELECT COALESCE(MAX(frame_index), -1) as max_idx FROM cms_scrollytelling_frames WHERE scrollytelling_id = $1',
        ['main']
      );
      index = parseInt(maxRes.rows[0].max_idx, 10) + 1;
    }
    const id = `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const res = await this.client.query(
      `INSERT INTO cms_scrollytelling_frames (id, scrollytelling_id, frame_index, frame_url, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id, 'main', index, frameUrl]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      scrollytelling_id: r.scrollytelling_id,
      frame_index: r.frame_index,
      frame_url: r.frame_url,
      created_at: r.created_at,
    };
  }

  async deleteScrollytellingFrame(frameId: string): Promise<void> {
    await this.initCmsTables();
    await this.client.query('DELETE FROM cms_scrollytelling_frames WHERE id = $1', [frameId]);
  }

  async reorderScrollytellingFrames(frameIds: string[]): Promise<void> {
    await this.initCmsTables();
    for (let i = 0; i < frameIds.length; i++) {
      await this.client.query(
        'UPDATE cms_scrollytelling_frames SET frame_index = $1 WHERE id = $2',
        [i, frameIds[i]]
      );
    }
  }

  // ========== STORAGE OPERATIONS ==========

  async saveUploadChunks(uploadId: string, chunks: string[]): Promise<void> {
    // Delete any old chunks for this key
    await this.client.query('DELETE FROM "temp_upload_chunks" WHERE "upload_id" = $1', [uploadId]);

    for (let i = 0; i < chunks.length; i++) {
      await this.client.query(
        'INSERT INTO "temp_upload_chunks" ("id", "upload_id", "chunk_index", "data", "created_at") VALUES (gen_random_uuid(), $1, $2, $3, NOW())',
        [uploadId, i, chunks[i]]
      );
    }
  }

  async getUploadChunks(uploadId: string): Promise<string[] | null> {
    const result = await this.client.query(
      'SELECT "data" FROM "temp_upload_chunks" WHERE "upload_id" = $1 ORDER BY "chunk_index" ASC',
      [uploadId]
    );

    if (result.rows.length === 0) return null;
    return result.rows.map((r: any) => r.data);
  }

  async verifyUploadExists(uploadId: string): Promise<boolean> {
    const result = await this.client.query(
      'SELECT COUNT(*) as count FROM "temp_upload_chunks" WHERE "upload_id" = $1',
      [uploadId]
    );
    return parseInt(result.rows[0]?.count || '0', 10) > 0;
  }

  // ========== UTILITY OPERATIONS ==========

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }
}
