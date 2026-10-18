/**
 * BREAKOUT MUSIC — Admin API Handlers
 *
 * Handles admin-only endpoints: audit logs, withdrawals, release reviews
 * All endpoints require admin or super_admin role verification
 */

import type { DatabaseAdapter, ApiResponse, RoyaltyRuleInput } from '../types/database';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { handleError, getStatusCode } from '../middleware/errors';
import { ValidationError, NotFoundError } from '../types/database';

function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const CSV_IMPORT_MAX_REQUEST_BYTES = 15 * 1024 * 1024;
const CSV_IMPORT_MAX_ROWS_PER_REQUEST = 5000;

async function readJsonBodyLimited<T>(request: Request, maxBytes: number): Promise<T> {
  if (!request.body) throw new ValidationError('A JSON request body is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ValidationError('CSV import request exceeds the 15 MB processing limit. Split the report into smaller files.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const payload = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ValidationError('CSV import request must contain a JSON object.');
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('CSV import request must contain valid JSON.');
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function streamingRowHash(row: Record<string, unknown>): Promise<string> {
  const revenue = Number(row.revenue);
  const canonical = [
    String(row.isrc || '').trim().toUpperCase(), String(row.upc || '').trim(),
    String(row.platform || '').trim().toLowerCase(), String(row.territory || '').trim().toUpperCase(),
    String(row.reportingPeriod || '').trim(), String(Number(row.streams)),
    Number.isFinite(revenue) ? revenue.toString() : '', String(row.currency || 'USD').trim().toUpperCase(),
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function streamingRowIdentity(row: Record<string, unknown>): Promise<string> {
  const identity = [
    String(row.isrc || '').trim().toUpperCase(), String(row.upc || '').trim(),
    String(row.platform || '').trim().toLowerCase(), String(row.territory || '').trim().toUpperCase(),
    String(row.reportingPeriod || '').trim(),
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return `row:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function handleAdminDashboardStats(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any,
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env, adapter);
    await requireAdmin(authContext, adapter);
    return jsonResponse({ success: true, data: await adapter.getAdminDashboardStats() }, 200, headers);
  } catch (error) {
    return jsonResponse(handleError(error), getStatusCode(error), headers);
  }
}

// ============================================================================
// AUDIT LOGS ENDPOINT
// ============================================================================

export async function handleAuditLogs(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/admin/audit-logs
    if (request.method === 'GET' && pathname === '/api/admin/audit-logs') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const action = url.searchParams.get('action');
      const entityType = url.searchParams.get('entity_type');
      const actorId = url.searchParams.get('actor_id');
      const search = url.searchParams.get('search');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      const result = await adapter.getAuditLogs({
        action: action || undefined,
        entity_type: entityType || undefined,
        actor_id: actorId || undefined,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit,
        offset,
      });

      return jsonResponse(
        {
          success: true,
          data: result,
        },
        200,
        headers
      );
    }

    // POST /api/admin/audit-logs (create audit log entry)
    if (request.method === 'POST' && pathname === '/api/admin/audit-logs') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const body = (await request.json()) as {
        action: string;
        entity_type: string;
        entity_id?: string;
        metadata?: Record<string, any>;
      };

      if (!body.action || !body.entity_type) {
        throw new ValidationError('action and entity_type are required');
      }

      const auditLog = await adapter.createAuditLog({
        actor_id: authContext.userId,
        action: body.action,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        metadata: body.metadata,
      });

      return jsonResponse(
        {
          success: true,
          data: auditLog,
        },
        201,
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

export async function handleAdminWithdrawals(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/admin/withdrawals
    if (request.method === 'GET' && pathname === '/api/admin/withdrawals') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const status = url.searchParams.get('status');
      const userId = url.searchParams.get('user_id');

      const result = await adapter.getWithdrawals({
        status: status || undefined,
        owner_id: userId || undefined,
        limit,
        offset,
      });

      return jsonResponse(
        {
          success: true,
          data: result,
        },
        200,
        headers
      );
    }

    // PUT /api/admin/withdrawals/:id (approve/reject withdrawal)
    const withdrawalMatch = pathname.match(/^\/api\/admin\/withdrawals\/([^/]+)$/);
    if (request.method === 'PUT' && withdrawalMatch) {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const withdrawalId = decodeURIComponent(withdrawalMatch[1]);
      const body = (await request.json()) as {
        status: 'approved' | 'rejected' | 'paid';
        rejection_reason?: string;
        reference_no?: string;
      };

      if (!body.status) {
        throw new ValidationError('status is required');
      }
      if (!['approved', 'rejected', 'paid'].includes(body.status)) {
        throw new ValidationError('status must be approved, rejected, or paid');
      }
      if (body.status === 'paid' && !body.reference_no?.trim()) {
        throw new ValidationError('A transfer reference is required before marking a withdrawal paid');
      }
      if (body.status === 'rejected' && !body.rejection_reason?.trim()) {
        throw new ValidationError('A rejection reason is required before rejecting a withdrawal.');
      }

      const withdrawal = await adapter.updateWithdrawalStatus(
        withdrawalId,
        body.status,
        body.status === 'paid' ? body.reference_no!.trim() : body.rejection_reason,
        authContext.userId
      );

      return jsonResponse(
        {
          success: true,
          data: withdrawal,
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

/** User administration backed exclusively by the configured Neon adapter. */
export async function handleAdminUsers(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any,
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env, adapter);
    await requireAdmin(authContext, adapter);
    const url = new URL(request.url);
    const pathname = url.pathname;

    const detailMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (request.method === 'GET' && detailMatch) {
      const userId = decodeURIComponent(detailMatch[1]);
      const user = await adapter.getUser(userId);
      if (!user) throw new NotFoundError('User not found');
      return jsonResponse({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          full_name: user.full_name || '',
          account_status: user.account_status,
          role: user.role || 'user',
          created_at: user.created_at || null,
        },
      }, 200, headers);
    }

    if (request.method === 'GET' && pathname === '/api/admin/users') {
      const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
      const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
      const search = url.searchParams.get('search') || undefined;
      const result = await adapter.listUsers(limit, offset, search);
      const users = result.data.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name || '',
        account_status: user.account_status,
        role: user.role || 'user',
        created_at: user.created_at || null,
        artistCount: Number(user.artistCount || 0),
        releaseCount: Number(user.releaseCount || 0),
      }));

      return jsonResponse({ success: true, data: { data: users, total: result.total } }, 200, headers);
    }

    const statusMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
    if (request.method === 'PUT' && statusMatch) {
      const userId = decodeURIComponent(statusMatch[1]);
      const body = await request.json() as { status?: string };
      if (body.status !== 'active' && body.status !== 'suspended') {
        throw new ValidationError('status must be active or suspended');
      }
      if (userId === authContext.userId && body.status === 'suspended') {
        throw new ValidationError('An admin cannot suspend their own account');
      }

      const updatedUser = await adapter.updateUser(userId, { account_status: body.status });
      await adapter.createAuditLog({
        actor_id: authContext.userId,
        action: body.status === 'suspended' ? 'suspend_user' : 'reactivate_user',
        entity_type: 'user',
        entity_id: userId,
        metadata: {},
      });
      return jsonResponse({ success: true, data: { id: updatedUser.id, account_status: updatedUser.account_status } }, 200, headers);
    }

    return jsonResponse({ success: false, error: 'Not found' }, 404, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

// ============================================================================
// RELEASE REVIEW ENDPOINT
// ============================================================================

export async function handleReleaseReview(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/admin/releases-review
    if (request.method === 'GET' && pathname === '/api/admin/releases-review') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const rawStatus = url.searchParams.get('status') || 'all';

      let status = 'all';
      const s = rawStatus.toLowerCase().trim();
      if (s === 'in_review' || s === 'submitted' || s === 'review') {
        status = 'REVIEW';
      } else if (s === 'approved') {
        status = 'APPROVED';
      } else if (s === 'rejected') {
        status = 'REJECTED';
      } else if (s === 'pending' || s === 'draft') {
        status = 'PENDING';
      } else if (s !== 'all') {
        status = rawStatus.toUpperCase();
      }

      const result = await adapter.getReleasesByStatus(status, limit, offset);
      const releaseList = (result && Array.isArray((result as any).data)) ? (result as any).data : (Array.isArray(result) ? result : []);
      const totalCount = (result && typeof (result as any).total === 'number') ? (result as any).total : releaseList.length;

      return jsonResponse(
        {
          success: true,
          data: releaseList,
          total: totalCount,
        },
        200,
        headers
      );
    }

    // PUT /api/admin/releases-review/:id (approve/reject release)
    const releaseMatch = pathname.match(/^\/api\/admin\/releases-review\/([^/]+)$/);
    if (request.method === 'PUT' && releaseMatch) {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const releaseId = decodeURIComponent(releaseMatch[1]);
      const body = (await request.json()) as {
        status: string;
        reason?: string;
      };

      if (!body.status) {
        throw new ValidationError('status is required');
      }

      const raw = body.status.toLowerCase().trim();
      if (!['approved', 'rejected'].includes(raw)) {
        throw new ValidationError('status must be approved or rejected');
      }
      if (raw === 'rejected' && !body.reason?.trim()) {
        throw new ValidationError('A rejection reason is required.');
      }
      const pgStatus = raw === 'approved' ? 'APPROVED' : 'REJECTED';

      const release = await adapter.updateReleaseStatus(releaseId, pgStatus, body.reason, authContext.userId);

      return jsonResponse(
        {
          success: true,
          data: release,
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
// CSV IMPORT ENDPOINT
// ============================================================================

export async function handleCsvImport(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const royaltyProcessMatch = pathname.match(/^\/api\/admin\/csv-import\/([^/]+)\/royalties$/);
    if (request.method === 'POST' && royaltyProcessMatch) {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);
      const reportId = decodeURIComponent(royaltyProcessMatch[1]);
      const report = await adapter.getCsvImportStatus(reportId);
      if (!report) throw new NotFoundError('CSV report not found.');
      const batchId = await adapter.processStreamingReportRoyalties(reportId, authContext.userId);
      return jsonResponse({ success: true, data: { reportId, batchId, status: 'completed' } }, 200, headers);
    }

    if (request.method === 'GET' && pathname === '/api/admin/csv-import') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
      const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
      const result = await adapter.listCsvImports({
        source: url.searchParams.get('source') || undefined,
        status: url.searchParams.get('status') || undefined,
        start_date: url.searchParams.get('start_date') || undefined,
        end_date: url.searchParams.get('end_date') || undefined,
        limit,
        offset,
      });
      return jsonResponse({ success: true, data: result }, 200, headers);
    }

    // POST /api/admin/csv-import (create CSV import job)
    if (request.method === 'POST' && pathname === '/api/admin/csv-import') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const body = (await request.json()) as {
        filename: string;
        source: string;
        file_hash: string;
        valid_rows: number;
        invalid_rows: number;
        report_identifier?: string;
        period_start?: string;
        period_end?: string;
        currency?: string | null;
      };

      if (!body.filename?.trim() || body.filename.length > 255 || !body.source?.trim() || body.source.length > 80
        || !/^[a-f0-9]{64}$/i.test(body.file_hash || '')
        || !Number.isSafeInteger(body.valid_rows) || body.valid_rows < 0
        || !Number.isSafeInteger(body.invalid_rows) || body.invalid_rows < 0) {
        throw new ValidationError('A safe filename, source, SHA-256 file hash, and non-negative row counts are required.');
      }
      if ((body.period_start && !isIsoDate(body.period_start)) || (body.period_end && !isIsoDate(body.period_end))
        || (body.period_start && body.period_end && body.period_start > body.period_end)) {
        throw new ValidationError('Report period must be a valid ordered date range.');
      }
      const reportCurrency = body.currency == null ? null : body.currency.trim().toUpperCase();
      if (reportCurrency && !/^[A-Z]{3}$/.test(reportCurrency)) throw new ValidationError('Report currency must be a 3-letter ISO code.');

      const csvImport = await adapter.createCsvImport({
        uploaded_by: authContext.userId,
        source: body.source,
        filename: body.filename,
        file_hash: body.file_hash,
        status: 'processing',
        total_rows: body.valid_rows + body.invalid_rows,
        valid_rows: body.valid_rows,
        invalid_rows: body.invalid_rows,
        report_identifier: body.report_identifier?.trim().slice(0, 200) || undefined,
        period_start: body.period_start,
        period_end: body.period_end,
        currency: reportCurrency,
      });

      return jsonResponse(
        {
          success: true,
          data: csvImport,
        },
        201,
        headers
      );
    }

    // GET /api/admin/csv-import/:id (get import status)
    const importMatch = pathname.match(/^\/api\/admin\/csv-import\/([^/]+)$/);
    if (request.method === 'GET' && importMatch) {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);

      const importId = decodeURIComponent(importMatch[1]);

      const csvImport = await adapter.getCsvImportStatus(importId);

      if (!csvImport) {
        throw new NotFoundError(`CSV import ${importId} not found`);
      }

      return jsonResponse(
        {
          success: true,
          data: csvImport,
        },
        200,
        headers
      );
    }

    const importSubresource = pathname.match(/^\/api\/admin\/csv-import\/([^/]+)\/(rows|errors)$/);
    if (importSubresource && request.method === 'GET') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);
      const importId = decodeURIComponent(importSubresource[1]);
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 500);
      const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
      if (importSubresource[2] === 'errors') {
        const errors = await adapter.getCsvImportErrors(importId, limit, offset);
        return jsonResponse({ success: true, data: errors.map((error) => ({
          rowNumber: error.row_number, errorCode: error.error_code,
          errorMessage: error.error_message, rawRow: error.raw_row,
        })) }, 200, headers);
      }
      const rows = await adapter.getStreamingRecordsByImport(importId, limit, offset);
      return jsonResponse({ success: true, data: rows }, 200, headers);
    }

    if (importSubresource && request.method === 'POST' && importSubresource[2] === 'rows') {
      const authContext = await requireAuth(request, env, adapter);
      await requireAdmin(authContext, adapter);
      const contentLength = Number(request.headers.get('content-length') || 0);
      if (Number.isFinite(contentLength) && contentLength > CSV_IMPORT_MAX_REQUEST_BYTES) {
        throw new ValidationError('CSV import request exceeds the 15 MB processing limit. Split the report into smaller files.');
      }
      const importId = decodeURIComponent(importSubresource[1]);
      const importRecord = await adapter.getCsvImportStatus(importId);
      if (!importRecord) throw new NotFoundError('CSV import not found');
      if (importRecord.status !== 'processing') throw new ValidationError('CSV import is not in processing state');

      const body = await readJsonBodyLimited<{
        rows?: Array<Record<string, unknown>>;
        validationErrors?: Array<{ rowNumber: number; errorCode: string; errorMessage: string; rawRow?: string }>;
      }>(request, CSV_IMPORT_MAX_REQUEST_BYTES);
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const validationErrors = Array.isArray(body.validationErrors) ? body.validationErrors : [];
      if (rows.length > CSV_IMPORT_MAX_ROWS_PER_REQUEST || validationErrors.length > CSV_IMPORT_MAX_ROWS_PER_REQUEST) {
        throw new ValidationError('CSV import requests are limited to 5,000 rows and 5,000 validation errors.');
      }
      const errors: Array<{ row_number: number; error_code: string; error_message: string; raw_row?: string }> = validationErrors.map((error) => ({
        row_number: Number.isSafeInteger(Number(error.rowNumber)) && Number(error.rowNumber) > 0 ? Number(error.rowNumber) : 1,
        error_code: String(error.errorCode || 'VALIDATION_ERROR').slice(0, 80),
        error_message: String(error.errorMessage || 'The source row did not pass validation.').slice(0, 500),
        raw_row: String(error.rawRow || '').slice(0, 1000),
      }));
      let inserted = 0;
      let duplicates = 0;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = index + 1;
        const isrc = typeof row.isrc === 'string' ? row.isrc.trim().toUpperCase() : '';
        const upc = typeof row.upc === 'string' ? row.upc.trim() : '';
        const platform = typeof row.platform === 'string' ? row.platform.trim() : '';
        const territory = typeof row.territory === 'string' ? row.territory.trim().toUpperCase() : '';
        const reportingPeriod = typeof row.reportingPeriod === 'string' ? row.reportingPeriod.trim() : '';
        const currency = typeof row.currency === 'string' ? row.currency.trim().toUpperCase() : 'USD';
        const streams = Number(row.streams);
        const revenue = Number(row.revenue ?? 0);
        const deductions = row.deductions === undefined ? 0 : Number(row.deductions);
        if (!/^[A-Z0-9]{12}$/.test(isrc) || (upc && !/^\d{12,20}$/.test(upc))
          || !platform || platform.length > 80 || !/^[A-Z]{2}$/.test(territory)
          || !isIsoDate(reportingPeriod) || !Number.isSafeInteger(streams) || streams < 0
          || !Number.isFinite(revenue) || revenue < 0 || revenue > 9999999999.999999
          || !Number.isFinite(deductions) || deductions < 0 || deductions > revenue
          || !/^[A-Z]{3}$/.test(currency)) {
          errors.push({ row_number: rowNumber, error_code: 'INVALID_ROW', error_message: 'Streaming row fields failed server validation.', raw_row: String(row.rawRow || '').slice(0, 1000) });
          continue;
        }

        // Resolve ownership and release linkage on the server. Client-supplied IDs/matches are informational only.
        const track = await adapter.getTrackByIsrc(isrc);
        if (!track) {
          errors.push({ row_number: rowNumber, error_code: 'UNMATCHED_TRACK', error_message: 'No registered track matches this ISRC.', raw_row: String(row.rawRow || '').slice(0, 1000) });
          continue;
        }
        const release = await adapter.getRelease(track.release_id);
        if (!release || release.owner_id !== track.owner_id || (upc && release.upc !== upc)
          || (typeof row.trackId === 'string' && row.trackId !== track.id)
          || (typeof row.releaseId === 'string' && row.releaseId !== release.id)) {
          errors.push({ row_number: rowNumber, error_code: 'MATCH_MISMATCH', error_message: 'ISRC, UPC, track, and release do not match a single registered owner.', raw_row: String(row.rawRow || '').slice(0, 1000) });
          continue;
        }

        const sourceHash = await streamingRowHash({ isrc, upc, platform, territory, reportingPeriod, streams, revenue, currency });
        const sourceIdentity = await streamingRowIdentity({ isrc, upc, platform, territory, reportingPeriod });
        try {
          if (await adapter.hasStreamingDuplicate(sourceHash) || await adapter.hasStreamingIdentityDuplicate(sourceIdentity)) {
            duplicates += 1;
            errors.push({ row_number: rowNumber, error_code: 'DUPLICATE_OR_CORRECTION_REQUIRED', error_message: 'This track/platform/territory/date row already exists. Corrections require an explicit reviewed correction workflow.' });
            continue;
          }
          await adapter.createStreamingRecord({
            id: '', report_id: importId,
            track_id: track.id, release_id: release.id, isrc, upc: upc || undefined,
            platform, territory, reporting_period: reportingPeriod, streams, revenue,
            deductions, net_revenue: revenue - deductions,
            currency, source_row_hash: sourceHash,
            report_period_start: importRecord.period_start,
            report_period_end: importRecord.period_end,
            source_row_reference: sourceIdentity,
            created_at: new Date().toISOString(),
          });
          inserted += 1;
        } catch (error) {
          if (error instanceof Error && error.message === 'DUPLICATE_SOURCE_ROW') {
            duplicates += 1;
            errors.push({ row_number: rowNumber, error_code: 'DUPLICATE_ROW', error_message: 'This source row was imported previously.' });
            continue;
          }
          errors.push({ row_number: rowNumber, error_code: 'INSERT_ERROR', error_message: 'The streaming row could not be saved.' });
        }
      }

      if (errors.length) await adapter.createCsvImportErrors(importId, errors);
      await adapter.updateCsvImport(importId, {
        status: errors.length ? 'partial' : 'completed', valid_rows: inserted, invalid_rows: errors.length, duplicate_rows: duplicates, completed_at: new Date().toISOString(),
      });
      await adapter.createAuditLog({ actor_id: authContext.userId, action: 'CSV_IMPORT_EXECUTED', entity_type: 'CsvImport', entity_id: importId,
        metadata: { insertedRows: inserted, duplicateRows: duplicates, errorRows: errors.length } });
      return jsonResponse({ success: true, data: {
        importId, status: errors.length ? 'partial' : 'completed', totalRows: rows.length + validationErrors.length,
        validRows: inserted, invalidRows: errors.length, duplicateRows: duplicates,
        insertedRecords: inserted,
        errors: errors.map((error) => ({ rowNumber: error.row_number, errorCode: error.error_code, errorMessage: error.error_message })),
      } }, 200, headers);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}

/** Versioned, admin-configured royalty shares; no default rate is applied. */
export async function handleAdminRoyaltyRules(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any,
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env, adapter);
    await requireAdmin(authContext, adapter);
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/admin/royalty-rules') {
      const artistId = url.searchParams.get('artist_id') || undefined;
      const rules = await adapter.listRoyaltyRules(artistId);
      return jsonResponse({ success: true, data: rules }, 200, headers);
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/royalty-rules') {
      const body = await request.json() as Partial<RoyaltyRuleInput>;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!body.artist_id || !uuid.test(body.artist_id) || !body.platform?.trim() || body.platform.length > 80
        || typeof body.share_percent !== 'number' || !Number.isFinite(body.share_percent)
        || body.share_percent <= 0 || body.share_percent > 100
        || (body.revenue_basis !== 'gross' && body.revenue_basis !== 'net')
        || body.currency !== 'USD' || !isIsoDate(body.effective_from)
        || (body.effective_until != null && !isIsoDate(body.effective_until))) {
        throw new ValidationError('Supply an artist, platform, 0–100% share, gross/net basis, USD currency, and valid effective dates.');
      }
      if (body.effective_until && body.effective_until < body.effective_from!) {
        throw new ValidationError('The rule end date cannot precede its start date.');
      }
      const rule = await adapter.createRoyaltyRule(body as RoyaltyRuleInput, authContext.userId);
      return jsonResponse({ success: true, data: rule }, 201, headers);
    }
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    return jsonResponse(errorResponse, getStatusCode(error), headers);
  }
}

export async function handleFinancialLedger(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any,
  adminOnly = false,
): Promise<Response> {
  try {
    if (request.method !== 'GET') return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
    const authContext = await requireAuth(request, env, adapter);
    if (adminOnly) await requireAdmin(authContext, adapter);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
    const ownerId = adminOnly ? url.searchParams.get('user_id') || undefined : authContext.userId;
    const [result, summary] = await Promise.all([
      adapter.getFinancialLedger(ownerId, limit, offset),
      ownerId ? adapter.getFinancialLedgerSummary(ownerId) : Promise.resolve(undefined),
    ]);
    return jsonResponse({ success: true, data: { ...result, ...(summary ? { summary } : {}) } }, 200, headers);
  } catch (error) {
    const errorResponse = handleError(error);
    return jsonResponse(errorResponse, getStatusCode(error), headers);
  }
}
