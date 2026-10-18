/**
 * BREAKOUT MUSIC — Cloudflare Workers API
 *
 * Entry point for the backend API that serves the React/Vite frontend.
 * Handles routing to database adapter layer with full authorization enforcement.
 */

import { createAdapter } from './adapters/factory';
import { requireAuth, requireOwnership, requireAdmin, getUserRole, type AuthContext } from './middleware/auth';
import { handleAuthRoute } from './handlers/authRoutes';
import { handleError, getStatusCode } from './middleware/errors';
import type { ApiResponse, ArtistInput, ReleaseInput, TrackInput, DatabaseAdapter } from './types/database';
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from './types/database';

interface Env {
  JWT_SECRET?: string;
  DATABASE_URL: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  CORS_ALLOWED_ORIGINS?: string;
  STORAGE_BUCKET?: R2Bucket;
  R2_BUCKET?: R2Bucket;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const headers = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Public endpoints (no auth required)
      if (pathname === '/health') {
        return handleHealth(env, headers);
      }

      // Storage get endpoint (public or token validated)
      if (pathname === '/api/storage/sign' && request.method === 'POST') {
        const { handleStorageSign } = await import('./handlers/storageHandler');
        const adapter = await createAdapter(env);
        return handleStorageSign(request, env, adapter, headers);
      }
      if (pathname.startsWith('/api/storage/')) {
        const { handleStorageGet } = await import('./handlers/storageHandler');
        const fileKey = pathname.replace(/^\/api\/storage\//, '');
        const adapter = await createAdapter(env);
        return handleStorageGet(request, env, adapter, headers, fileKey);
      }

      const authResponse = await handleAuthRoute(request, env, headers, { createAdapter });
      if (authResponse) return authResponse;

      // Initialize adapter
      const adapter = await createAdapter(env);

      if (pathname.startsWith('/api/notifications')) {
        const { handleNotifications } = await import('./handlers/notificationHandler');
        return handleNotifications(request, env, adapter, headers);
      }

      // Upload endpoint
      if (pathname === '/api/uploads' && request.method === 'POST') {
        const { handleUpload } = await import('./handlers/storageHandler');
        return handleUpload(request, env, adapter, headers);
      }

      // Final submit release for review endpoint
      const submitMatch = pathname.match(/^\/api\/releases\/([^/]+)\/submit$/);
      if (submitMatch && request.method === 'POST') {
        const { handleReleaseSubmit } = await import('./handlers/storageHandler');
        const releaseId = decodeURIComponent(submitMatch[1]);
        return handleReleaseSubmit(request, env, adapter, headers, releaseId);
      }

      // Route to appropriate handler
      if (pathname.startsWith('/api/artists')) {
        return handleArtists(request, env, adapter, headers);
      }

      if (pathname.startsWith('/api/releases')) {
        return handleReleases(request, env, adapter, headers);
      }

      if (pathname.startsWith('/api/tracks')) {
        return handleTracks(request, env, adapter, headers);
      }

      if (pathname === '/api/streaming/aggregates') {
        const { handleArtistStreamingAggregates } = await import('./handlers/artistFinanceHandler');
        return handleArtistStreamingAggregates(request, env, adapter, headers);
      }

      if (pathname.startsWith('/api/streaming')) {
        return handleStreaming(request, env, adapter, headers);
      }

      if (pathname.startsWith('/api/royalties')) {
        return handleRoyalties(request, env, adapter, headers);
      }

      if (pathname.startsWith('/api/withdrawals')) {
        return handleWithdrawals(request, env, adapter, headers);
      }

      if (pathname === '/api/financial-ledger') {
        const { handleFinancialLedger } = await import('./handlers/adminHandler');
        return handleFinancialLedger(request, adapter, headers, env, false);
      }

      // Public CMS endpoints (no auth required)
      if (pathname === '/api/public/landing' || pathname === '/api/cms/landing') {
        const { handlePublicLanding } = await import('./handlers/cmsHandler');
        return handlePublicLanding(request, adapter, headers);
      }

      if (pathname === '/api/public/testimonials' || pathname === '/api/cms/testimonials') {
        const { handlePublicTestimonials } = await import('./handlers/cmsHandler');
        return handlePublicTestimonials(request, adapter, headers);
      }

      if (pathname === '/api/public/faqs' || pathname === '/api/cms/faqs') {
        const { handlePublicFaqs } = await import('./handlers/cmsHandler');
        return handlePublicFaqs(request, adapter, headers);
      }

      if (pathname === '/api/public/scrollytelling' || pathname === '/api/cms/scrollytelling') {
        const { handlePublicScrollytelling } = await import('./handlers/cmsHandler');
        return handlePublicScrollytelling(request, adapter, headers);
      }

      // Admin endpoints (require admin role)
      if (pathname.startsWith('/api/admin/')) {
        if (pathname.startsWith('/api/admin/artist-finance/')) {
          const { handleAdminArtistFinance } = await import('./handlers/artistFinanceHandler');
          return handleAdminArtistFinance(request, env, adapter, headers);
        }
        if (pathname === '/api/admin/dashboard-stats') {
          const { handleAdminDashboardStats } = await import('./handlers/adminHandler');
          return handleAdminDashboardStats(request, adapter, headers, env);
        }
        if (pathname.startsWith('/api/admin/cms')) {
          const { handleAdminCms } = await import('./handlers/cmsHandler');
          return handleAdminCms(request, adapter, headers, env);
        }

        const { handleAdminUsers, handleAuditLogs, handleAdminWithdrawals, handleReleaseReview, handleCsvImport, handleAdminRoyaltyRules, handleFinancialLedger } = await import('./handlers/adminHandler');

        if (pathname.startsWith('/api/admin/users')) {
          return handleAdminUsers(request, adapter, headers, env);
        }

        if (pathname.startsWith('/api/admin/audit-logs')) {
          return handleAuditLogs(request, adapter, headers, env);
        }

        if (pathname.startsWith('/api/admin/withdrawals')) {
          return handleAdminWithdrawals(request, adapter, headers, env);
        }

        if (pathname.startsWith('/api/admin/releases-review')) {
          return handleReleaseReview(request, adapter, headers, env);
        }

        if (pathname.startsWith('/api/admin/csv-import')) {
          return handleCsvImport(request, adapter, headers, env);
        }

        if (pathname === '/api/admin/royalty-rules') {
          return handleAdminRoyaltyRules(request, adapter, headers, env);
        }

        if (pathname === '/api/admin/financial-ledger') {
          return handleFinancialLedger(request, adapter, headers, env, true);
        }
      }

      // 404
      return jsonResponse({ success: false, error: 'Not found' }, 404, headers);
    } catch (error) {
      console.error('API Error:', error);
      const errorResponse = handleError(error);
      const statusCode = getStatusCode(error);
      return jsonResponse(errorResponse, statusCode, headers);
    }
  },
};

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

async function handleHealth(env: Env, headers: Record<string, string>): Promise<Response> {
  try {
    const adapter = await createAdapter(env);
    const isHealthy = await adapter.healthCheck();

    return jsonResponse(
      {
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          provider: 'neon',
          environment: env.ENVIRONMENT || 'development',
          timestamp: new Date().toISOString(),
        },
      },
      200,
      headers
    );
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: 'Health check failed',
        data: { details: error instanceof Error ? error.message : 'Unknown error' },
      },
      503,
      headers
    );
  }
}

// ============================================================================
// ARTISTS ENDPOINT
// ============================================================================

async function handleArtists(
  request: Request,
  env: Env,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/artists (list artists)
    if (request.method === 'GET' && pathname === '/api/artists') {
      const authContext = await requireAuth(request, env, adapter);
      const requestedOwnerId = url.searchParams.get('owner_id');
      const role = await getUserRole(authContext.userId, adapter);
      const isAdmin = role === 'admin' || role === 'super_admin';
      const ownerId = isAdmin ? (requestedOwnerId || undefined) : authContext.userId;
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const result = await adapter.listArtists(ownerId, limit, offset);

      return jsonResponse(
        {
          success: true,
          data: {
            data: result.data,
            total: result.total,
            limit,
            offset,
          },
        },
        200,
        headers
      );
    }

    // GET /api/artists/:id (get single artist)
    const artistMatch = pathname.match(/^\/api\/artists\/([^/]+)$/);
    if (request.method === 'GET' && artistMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const artistId = decodeURIComponent(artistMatch[1]);
      const artist = await adapter.getArtist(artistId);

      if (!artist) {
        throw new NotFoundError(`Artist ${artistId} not found`);
      }

      await requireOwnership(authContext, artist.owner_id, adapter);

      return jsonResponse({ success: true, data: artist }, 200, headers);
    }

    // POST /api/artists (create artist)
    if (request.method === 'POST' && pathname === '/api/artists') {
      const authContext = await requireAuth(request, env, adapter);
      const body = (await request.json()) as ArtistInput;

      if (!body.artist_name) {
        throw new ValidationError('artist_name is required');
      }

      const artist = await adapter.createArtist(authContext.userId, body);

      return jsonResponse({ success: true, data: artist }, 201, headers);
    }

    // PUT /api/artists/:id (update artist)
    if (request.method === 'PUT' && artistMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const artistId = decodeURIComponent(artistMatch[1]);

      const artist = await adapter.getArtist(artistId);
      if (!artist) {
        throw new NotFoundError(`Artist ${artistId} not found`);
      }

      await requireOwnership(authContext, artist.owner_id, adapter);

      const body = (await request.json()) as Partial<ArtistInput>;
      const updated = await adapter.updateArtist(artistId, body);

      return jsonResponse({ success: true, data: updated }, 200, headers);
    }

    // DELETE /api/artists/:id (delete artist)
    if (request.method === 'DELETE' && artistMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const artistId = decodeURIComponent(artistMatch[1]);

      const artist = await adapter.getArtist(artistId);
      if (!artist) {
        throw new NotFoundError(`Artist ${artistId} not found`);
      }

      await requireOwnership(authContext, artist.owner_id, adapter);
      await adapter.deleteArtist(artistId);

      return jsonResponse({ success: true, data: {} }, 200, headers);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// RELEASES ENDPOINT
// ============================================================================

export async function handleReleases(
  request: Request,
  env: Env,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'GET' && pathname === '/api/releases/by-upc') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);
      const upc = url.searchParams.get('upc')?.trim();
      if (!upc) throw new ValidationError('upc is required');
      const release = await adapter.getReleasByUpc(upc);
      return jsonResponse({ success: true, data: release }, 200, headers);
    }

    // GET /api/releases (list releases)
    if (request.method === 'GET' && pathname === '/api/releases') {
      const authContext = await requireAuth(request, env, adapter);
      const role = await getUserRole(authContext.userId, adapter);
      const isAdmin = role === 'admin' || role === 'super_admin';
      const requestedOwnerId = url.searchParams.get('owner_id');

      // CRITICAL: Never trust client-supplied owner_id for non-admin users!
      // Non-admin users are strictly locked to their verified server-side session userId.
      const ownerId = isAdmin ? (requestedOwnerId || undefined) : authContext.userId;
      const artistId = url.searchParams.get('artist_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      let result;
      if (artistId) {
        // If not admin, strictly verify user owns this artist profile
        if (!isAdmin) {
          const artist = await adapter.getArtist(artistId);
          if (!artist || artist.owner_id !== authContext.userId) {
            throw new AuthorizationError('Access denied: You do not own this artist profile');
          }
        }
        result = await adapter.listReleasesByArtist(artistId, limit, offset);
      } else {
        result = await adapter.listReleases(ownerId, limit, offset);
      }

      return jsonResponse(
        {
          success: true,
          data: {
            data: result.data,
            total: result.total,
            limit,
            offset,
          },
        },
        200,
        headers
      );
    }

    const historyMatch = pathname.match(/^\/api\/releases\/([^/]+)\/history$/);
    if (request.method === 'GET' && historyMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const release = await adapter.getRelease(decodeURIComponent(historyMatch[1]));
      if (!release) throw new NotFoundError('Release not found.');
      await requireOwnership(authContext, release.owner_id, adapter);
      const history = await adapter.getReleaseStatusHistory(release.id);
      return jsonResponse({ success: true, data: history }, 200, headers);
    }

    // GET /api/releases/:id (get single release - strictly protected)
    const releaseMatch = pathname.match(/^\/api\/releases\/([^/]+)$/);
    if (request.method === 'GET' && releaseMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const releaseId = decodeURIComponent(releaseMatch[1]);
      const release = await adapter.getRelease(releaseId);

      if (!release) {
        throw new NotFoundError(`Release ${releaseId} not found`);
      }

      // Enforce ownership: only owner or admin can view release details
      await requireOwnership(authContext, release.owner_id, adapter);

      return jsonResponse({ success: true, data: release }, 200, headers);
    }

    // POST /api/releases (create release)
    if (request.method === 'POST' && pathname === '/api/releases') {
      const authContext = await requireAuth(request, env, adapter);
      const body = (await request.json()) as ReleaseInput;

      if (!body.title) {
        throw new ValidationError('title is required');
      }

      const release = await adapter.createRelease(authContext.userId, body);

      return jsonResponse({ success: true, data: release }, 201, headers);
    }

    // PUT /api/releases/:id (update release)
    if (request.method === 'PUT' && releaseMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const releaseId = decodeURIComponent(releaseMatch[1]);

      const release = await adapter.getRelease(releaseId);
      if (!release) {
        throw new NotFoundError(`Release ${releaseId} not found`);
      }

      await requireOwnership(authContext, release.owner_id, adapter);

      const body = (await request.json()) as Partial<ReleaseInput>;
      if ('status' in (body as Record<string, unknown>)) {
        throw new AuthorizationError('Release status can only be changed through the admin review workflow.');
      }
      if (release.status !== 'draft' && release.status !== 'rejected') {
        throw new AuthorizationError('Release metadata can only be edited while the submission is a draft or rejected.');
      }
      const updated = await adapter.updateRelease(releaseId, body);

      return jsonResponse({ success: true, data: updated }, 200, headers);
    }

    // DELETE /api/releases/:id (delete release)
    if (request.method === 'DELETE' && releaseMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const releaseId = decodeURIComponent(releaseMatch[1]);

      const release = await adapter.getRelease(releaseId);
      if (!release) {
        throw new NotFoundError(`Release ${releaseId} not found`);
      }

      await requireOwnership(authContext, release.owner_id, adapter);
      if (release.status !== 'draft' && release.status !== 'rejected') {
        throw new AuthorizationError('Only draft or rejected releases can be deleted.');
      }
      await adapter.deleteRelease(releaseId);

      return jsonResponse({ success: true, data: {} }, 200, headers);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// TRACKS ENDPOINT
// ============================================================================

async function handleTracks(
  request: Request,
  env: Env,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/tracks (list tracks)
    if (request.method === 'GET' && pathname === '/api/tracks') {
      const authContext = await requireAuth(request, env, adapter);
      const role = await getUserRole(authContext.userId, adapter);
      const isAdmin = role === 'admin' || role === 'super_admin';

      const releaseId = url.searchParams.get('release_id');
      const isrc = url.searchParams.get('isrc');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      if (!releaseId && !isrc) {
        throw new ValidationError('release_id or isrc is required');
      }

      // Verify release ownership if querying by releaseId
      if (releaseId && !isAdmin) {
        const release = await adapter.getRelease(releaseId);
        if (!release) {
          throw new NotFoundError(`Release ${releaseId} not found`);
        }
        await requireOwnership(authContext, release.owner_id, adapter);
      }

      let result;
      if (isrc) {
        const track = await adapter.getTrackByIsrc(isrc);
        if (track && !isAdmin) {
          await requireOwnership(authContext, track.owner_id, adapter);
        }
        result = track ? { data: [track], total: 1 } : { data: [], total: 0 };
      } else {
        result = await adapter.listTracks(releaseId!, limit, offset);
      }

      return jsonResponse(
        {
          success: true,
          data: {
            data: result.data,
            total: result.total,
            limit,
            offset,
          },
        },
        200,
        headers
      );
    }

    // GET /api/tracks/:id (get single track)
    const trackMatch = pathname.match(/^\/api\/tracks\/([^/]+)$/);
    if (request.method === 'GET' && trackMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const trackId = decodeURIComponent(trackMatch[1]);
      const track = await adapter.getTrack(trackId);

      if (!track) {
        throw new NotFoundError(`Track ${trackId} not found`);
      }

      // Enforce ownership: only track owner or admin can retrieve track details
      await requireOwnership(authContext, track.owner_id, adapter);

      return jsonResponse({ success: true, data: track }, 200, headers);
    }

    // POST /api/tracks (create track)
    if (request.method === 'POST' && pathname === '/api/tracks') {
      const authContext = await requireAuth(request, env, adapter);
      const body = (await request.json()) as TrackInput & { release_id: string };

      if (!body.release_id || !body.title) {
        throw new ValidationError('release_id and title are required');
      }

      // Verify user owns the target release before creating track
      const release = await adapter.getRelease(body.release_id);
      if (!release) {
        throw new NotFoundError(`Release ${body.release_id} not found`);
      }
      await requireOwnership(authContext, release.owner_id, adapter);

      const track = await adapter.createTrack(body.release_id, authContext.userId, body);

      return jsonResponse({ success: true, data: track }, 201, headers);
    }

    // PUT /api/tracks/:id (update track)
    if (request.method === 'PUT' && trackMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const trackId = decodeURIComponent(trackMatch[1]);

      const track = await adapter.getTrack(trackId);
      if (!track) {
        throw new NotFoundError(`Track ${trackId} not found`);
      }

      await requireOwnership(authContext, track.owner_id, adapter);

      const body = (await request.json()) as Partial<TrackInput>;
      const updated = await adapter.updateTrack(trackId, body);

      return jsonResponse({ success: true, data: updated }, 200, headers);
    }

    // DELETE /api/tracks/:id (delete track)
    if (request.method === 'DELETE' && trackMatch) {
      const authContext = await requireAuth(request, env, adapter);
      const trackId = decodeURIComponent(trackMatch[1]);

      const track = await adapter.getTrack(trackId);
      if (!track) {
        throw new NotFoundError(`Track ${trackId} not found`);
      }

      await requireOwnership(authContext, track.owner_id, adapter);
      await adapter.deleteTrack(trackId);

      return jsonResponse({ success: true, data: {} }, 200, headers);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// STREAMING ENDPOINT
// ============================================================================

async function handleStreaming(
  request: Request,
  env: Env,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const authContext = await requireAuth(request, env, adapter);
      const role = await getUserRole(authContext.userId, adapter);
      const isAdmin = role === 'admin' || role === 'super_admin';

      if (url.pathname === '/api/streaming/duplicate') {
        if (!isAdmin) throw new AuthorizationError('Admin access required');
        const sourceRowHash = url.searchParams.get('source_row_hash')?.trim();
        const sourceRowIdentity = url.searchParams.get('source_row_identity')?.trim();
        if (!sourceRowHash && !sourceRowIdentity) throw new ValidationError('source_row_hash or source_row_identity is required');
        const isDuplicate = (sourceRowHash ? await adapter.hasStreamingDuplicate(sourceRowHash) : false)
          || (sourceRowIdentity ? await adapter.hasStreamingIdentityDuplicate(sourceRowIdentity) : false);
        return jsonResponse({ success: true, data: { is_duplicate: isDuplicate } }, 200, headers);
      }

      const trackId = url.searchParams.get('track_id');
      const releaseId = url.searchParams.get('release_id');
      const artistId = url.searchParams.get('artist_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      // Enforce ownership for non-admin callers
      let ownerId: string | undefined;
      if (!isAdmin) {
        if (releaseId) {
          const release = await adapter.getRelease(releaseId);
          if (!release) throw new NotFoundError(`Release ${releaseId} not found`);
          await requireOwnership(authContext, release.owner_id, adapter);
        }
        if (trackId) {
          const track = await adapter.getTrack(trackId);
          if (!track) throw new NotFoundError(`Track ${trackId} not found`);
          await requireOwnership(authContext, track.owner_id, adapter);
        }
        if (artistId) {
          const artist = await adapter.getArtist(artistId);
          if (!artist || artist.owner_id !== authContext.userId) {
            throw new AuthorizationError('Access denied: You do not own this artist profile');
          }
        }
        if (!trackId && !releaseId && !artistId) ownerId = authContext.userId;
      }

      const result = await adapter.getStreamingRecords({
        track_id: trackId || undefined,
        release_id: releaseId || undefined,
        artist_id: artistId || undefined,
        owner_id: ownerId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit,
        offset,
      });

      return jsonResponse(
        {
          success: true,
          data: {
            data: result.data,
            total: result.total,
            limit,
            offset,
          },
        },
        200,
        headers
      );
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// ROYALTIES ENDPOINT
// ============================================================================

export async function handleRoyalties(
  request: Request,
  env: Env,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const authContext = await requireAuth(request, env, adapter);
      const role = await getUserRole(authContext.userId, adapter);
      const isAdmin = role === 'admin' || role === 'super_admin';

      const requestedArtistId = url.searchParams.get('artist_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 500);
      const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

      if (url.pathname === '/api/royalties/calculation-items') {
        const result = await adapter.getRoyaltyCalculationItemsForOwner(authContext.userId, limit, offset);
        return jsonResponse({ success: true, data: { data: result.data, total: result.total, limit, offset } }, 200, headers);
      }

      let artistIds: string[];
      if (requestedArtistId && requestedArtistId !== authContext.userId) {
        const artist = await adapter.getArtist(requestedArtistId);
        if (!artist || (!isAdmin && artist.owner_id !== authContext.userId)) {
          throw new AuthorizationError('Access denied: You do not own this artist profile');
        }
        artistIds = [artist.id];
      } else {
        const artists = await adapter.listArtists(isAdmin && !requestedArtistId ? undefined : authContext.userId, 500, 0);
        artistIds = artists.data.map((artist) => artist.id);
      }

      const perArtist = await Promise.all(artistIds.map(async (artistId) => {
        if (startDate && endDate) return adapter.getRoyaltiesByPeriod(artistId, startDate, endDate);
        return (await adapter.getRoyalties(artistId, 500, 0)).data;
      }));
      const records = perArtist.flat();
      const manualRoyalties = await adapter.listManualArtistRoyalties({
        artist_id: requestedArtistId && requestedArtistId !== authContext.userId ? requestedArtistId : undefined,
        owner_id: isAdmin ? undefined : authContext.userId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        include_superseded: false,
        limit: 500,
        offset: 0,
      });
      records.push(...manualRoyalties.data
        .filter((entry) => isAdmin || entry.status === 'finalized')
        .map((entry) => ({
          id: entry.id,
          owner_id: entry.owner_id,
          artist_id: entry.artist_id,
          artist_name: entry.artist_name,
          song_name: `Royalti Artis: ${entry.artist_name} (${entry.period_start.slice(0, 7)})`,
          streams: entry.streams,
          amount: Number(entry.net_royalty),
          gross_revenue: entry.gross_revenue == null ? undefined : Number(entry.gross_revenue),
          deductions: Number(entry.deductions),
          net_revenue: Number(entry.net_royalty),
          currency: entry.currency,
          reporting_period: entry.period_start,
          royalty_type: 'other' as const,
          status: entry.status === 'draft' ? 'estimated' as const : 'finalized' as const,
          created_at: entry.created_at,
          source: 'manual_artist_royalty',
          report_identifier: entry.report_identifier,
        })));
      records.sort((a, b) => b.reporting_period.localeCompare(a.reporting_period));
      const result = { data: records.slice(offset, offset + limit), total: records.length };

      return jsonResponse(
        {
          success: true,
          data: {
            data: result.data,
            total: result.total,
            limit,
            offset,
          },
        },
        200,
        headers
      );
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// WITHDRAWALS ENDPOINT
// ============================================================================

async function handleWithdrawals(
  request: Request,
  env: Env,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env, adapter);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
      const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
      const result = await adapter.getWithdrawals({ owner_id: authContext.userId, limit, offset });
      return jsonResponse(
        {
          success: true,
          data: {
            ...result,
            limit,
            offset,
          },
        },
        200,
        headers
      );
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as {
        amount: number;
        currency?: string;
        payout_method: string;
        payout_reference: string;
      };
      if (!Number.isFinite(body.amount) || body.amount < 50) throw new ValidationError('Minimum withdrawal is USD 50');
      if ((body.currency || 'USD') !== 'USD') throw new ValidationError('Withdrawals are currently supported in USD only');
      if (!body.payout_method?.trim() || !body.payout_reference?.trim() || body.payout_reference.length > 2048) {
        throw new ValidationError('Valid payout details are required');
      }

      const created = await adapter.createWithdrawal({
        owner_id: authContext.userId,
        amount: body.amount,
        currency: 'USD',
        payout_method: body.payout_method.trim(),
        payout_reference: body.payout_reference.trim(),
      });
      return jsonResponse({ success: true, data: created }, 201, headers);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigin = env.ENVIRONMENT === 'development'
    ? '*'
    : allowedOrigins.includes(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}
