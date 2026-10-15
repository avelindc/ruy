/**
 * BREAKOUT MUSIC — Admin API Handlers
 *
 * Handles admin-only endpoints: audit logs, withdrawals, release reviews
 * All endpoints require admin or super_admin role verification
 */

import type { DatabaseAdapter, ApiResponse } from '../types/database';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { handleError, getStatusCode } from '../middleware/errors';
import { ValidationError, NotFoundError } from '../types/database';

function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export async function handleAdminDashboardStats(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any,
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
    const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
      let pgStatus = 'REVIEW';
      if (raw === 'approved') pgStatus = 'APPROVED';
      else if (raw === 'rejected') pgStatus = 'REJECTED';
      else if (raw === 'pending' || raw === 'draft') pgStatus = 'PENDING';

      const release = await adapter.updateReleaseStatus(releaseId, pgStatus, body.reason, authContext.userId);

      try {
        await adapter.createAuditLog({
          actor_id: authContext.userId,
          action: pgStatus === 'APPROVED' ? 'release.approve' : 'release.reject',
          entity_type: 'release',
          entity_id: releaseId,
          metadata: {
            reason: body.reason || null,
            status: pgStatus,
          },
        });
      } catch (logErr) {
        // Continue even if audit log insert encounters table issues
      }

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

    if (request.method === 'GET' && pathname === '/api/admin/csv-import') {
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
      await requireAdmin(authContext, adapter);

      const body = (await request.json()) as {
        filename: string;
        source: string;
        file_hash: string;
        valid_rows: number;
        invalid_rows: number;
      };

      if (!body.filename || !body.source || !body.file_hash) {
        throw new ValidationError('filename, source, and file_hash are required');
      }

      const csvImport = await adapter.createCsvImport({
        uploaded_by: authContext.userId,
        source: body.source,
        filename: body.filename,
        file_hash: body.file_hash,
        status: 'processing',
        total_rows: body.valid_rows + body.invalid_rows,
        valid_rows: body.valid_rows,
        invalid_rows: body.invalid_rows,
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
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
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
      const authContext = await requireAuth(request, env);
      await requireAdmin(authContext, adapter);
      const importId = decodeURIComponent(importSubresource[1]);
      const importRecord = await adapter.getCsvImportStatus(importId);
      if (!importRecord) throw new NotFoundError('CSV import not found');
      if (importRecord.status !== 'processing') throw new ValidationError('CSV import is not in processing state');

      const body = await request.json() as {
        rows?: Array<Record<string, unknown>>;
        validationErrors?: Array<{ rowNumber: number; errorCode: string; errorMessage: string; rawRow?: string }>;
      };
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const validationErrors = Array.isArray(body.validationErrors) ? body.validationErrors : [];
      const errors: Array<{ row_number: number; error_code: string; error_message: string; raw_row?: string }> = validationErrors.map((error) => ({
        row_number: Number(error.rowNumber), error_code: String(error.errorCode),
        error_message: String(error.errorMessage), raw_row: String(error.rawRow || ''),
      }));
      let inserted = 0;
      let duplicates = 0;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = index + 1;
        const sourceHash = typeof row.sourceRowHash === 'string' ? row.sourceRowHash : '';
        if (!sourceHash || typeof row.platform !== 'string' || typeof row.territory !== 'string'
          || !Number.isFinite(Number(row.streams)) || !Number.isFinite(Number(row.revenue))) {
          errors.push({ row_number: rowNumber, error_code: 'INVALID_ROW', error_message: 'Required streaming row fields are missing.' });
          continue;
        }
        try {
          if (await adapter.hasStreamingDuplicate(sourceHash)) {
            duplicates += 1;
            errors.push({ row_number: rowNumber, error_code: 'DUPLICATE_ROW', error_message: 'This source row was imported previously.' });
            continue;
          }
          await adapter.createStreamingRecord({
            id: '', report_id: importId,
            track_id: typeof row.trackId === 'string' ? row.trackId : undefined,
            release_id: typeof row.releaseId === 'string' ? row.releaseId : undefined,
            isrc: typeof row.isrc === 'string' ? row.isrc : undefined,
            upc: typeof row.upc === 'string' ? row.upc : undefined,
            platform: row.platform,
            territory: row.territory,
            reporting_period: String(row.reportingPeriod || ''),
            streams: Number(row.streams),
            revenue: Number(row.revenue),
            currency: typeof row.currency === 'string' ? row.currency : 'USD',
            source_row_hash: sourceHash,
            created_at: new Date().toISOString(),
          });
          inserted += 1;
        } catch {
          errors.push({ row_number: rowNumber, error_code: 'INSERT_ERROR', error_message: 'The streaming row could not be saved.' });
        }
      }

      if (errors.length) await adapter.createCsvImportErrors(importId, errors);
      await adapter.updateCsvImport(importId, {
        status: 'completed', duplicate_rows: duplicates, completed_at: new Date().toISOString(),
      });
      await adapter.createAuditLog({ actor_id: authContext.userId, action: 'CSV_IMPORT_EXECUTED', entity_type: 'CsvImport', entity_id: importId,
        metadata: { insertedRows: inserted, duplicateRows: duplicates, errorRows: errors.length } });
      return jsonResponse({ success: true, data: {
        importId, status: errors.length ? 'partial' : 'completed', totalRows: rows.length + validationErrors.length,
        validRows: rows.length, invalidRows: validationErrors.length, duplicateRows: duplicates,
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
