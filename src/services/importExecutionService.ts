import { apiGet, apiPost } from '@lib/api/client';
import type { RowWithMatch } from './matchingService';
import type { ValidationError } from './csvParserService';

export interface ImportExecutionResult {
  importId: string;
  status: 'completed' | 'partial' | 'failed';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  insertedRecords: number;
  errors: Array<{ rowNumber: number; errorCode: string; errorMessage: string }>;
}

export async function executeImport(
  filename: string,
  fileHash: string,
  source: string,
  _uploadedBy: string,
  validRows: RowWithMatch[],
  validationErrors: ValidationError[],
): Promise<ImportExecutionResult> {
  const periods = validRows.map((row) => row.reportingPeriod).sort();
  const created = await apiPost<any>('/api/admin/csv-import', {
    filename, file_hash: fileHash, source,
    valid_rows: validRows.length, invalid_rows: validationErrors.length,
    period_start: periods[0],
    period_end: periods[periods.length - 1],
    currency: new Set(validRows.map((row) => row.currency)).size === 1 ? validRows[0]?.currency : null,
  });
  const importId = created.data?.id;
  if (!created.success || typeof importId !== 'string') throw new Error(created.error || 'Could not start the CSV import.');

  const saved = await apiPost<ImportExecutionResult>(`/api/admin/csv-import/${encodeURIComponent(importId)}/rows`, {
    rows: validRows,
    validationErrors,
  });
  if (!saved.success || !saved.data) throw new Error(saved.error || 'Could not finish the CSV import.');
  return saved.data;
}

export async function getImportHistory(
  _adminId: string,
  filters?: { source?: string; status?: string; startDate?: string; endDate?: string; limit?: number; offset?: number },
) {
  const params = new URLSearchParams({ limit: String(filters?.limit || 50), offset: String(filters?.offset || 0) });
  if (filters?.source) params.set('source', filters.source);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.startDate) params.set('start_date', filters.startDate);
  if (filters?.endDate) params.set('end_date', filters.endDate);
  const response = await apiGet<any>(`/api/admin/csv-import?${params}`);
  if (!response.success) throw new Error(response.error || 'Failed to fetch import history');
  return { imports: response.data?.data || [], total: response.data?.total || 0 };
}

export async function getImportErrors(importId: string, limit = 100, offset = 0) {
  const response = await apiGet<any>(`/api/admin/csv-import/${encodeURIComponent(importId)}/errors?limit=${limit}&offset=${offset}`);
  if (!response.success) throw new Error(response.error || 'Failed to fetch import errors');
  return response.data || [];
}

export async function getStreamingRecordsByImport(importId: string, limit = 100, offset = 0) {
  const response = await apiGet<any>(`/api/admin/csv-import/${encodeURIComponent(importId)}/rows?limit=${limit}&offset=${offset}`);
  if (!response.success) throw new Error(response.error || 'Failed to fetch imported streaming rows');
  return response.data || [];
}
