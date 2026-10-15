import { apiGet, apiPost } from '@lib/api/client';

type AuditFilters = {
  action?: string;
  entityType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
};

function filtersQuery(filters?: AuditFilters) {
  const params = new URLSearchParams();
  if (filters?.action) params.set('action', filters.action);
  if (filters?.entityType) params.set('entity_type', filters.entityType);
  if (filters?.actorId) params.set('actor_id', filters.actorId);
  if (filters?.startDate) params.set('start_date', filters.startDate);
  if (filters?.endDate) params.set('end_date', filters.endDate);
  return params;
}

export async function createAuditLog(action: string, entityType: string, entityId: string | null,
  metadata: Record<string, unknown> | null, _actorId: string) {
  try {
    await apiPost('/api/admin/audit-logs', { action, entity_type: entityType, entity_id: entityId, metadata });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to create audit log') };
  }
}

async function queryLogs(limit: number, offset: number, filters?: AuditFilters, search?: string) {
  try {
    const params = filtersQuery(filters);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (search) params.set('search', search);
    const response = await apiGet<any>(`/api/admin/audit-logs?${params}`);
    return { data: response.data?.data || [], total: response.data?.total || 0, error: null };
  } catch (error) {
    return { data: [], total: 0, error: error instanceof Error ? error : new Error('Failed to fetch audit logs') };
  }
}

export const getAuditLogs = (limit = 50, offset = 0, filters?: AuditFilters) => queryLogs(limit, offset, filters);

export async function searchAuditLogs(query: string, limit = 50, offset = 0) {
  if (!query.trim()) return { data: [], total: 0, error: new Error('Search query is required') };
  return queryLogs(limit, offset, undefined, query.trim());
}

export async function getEntityAuditLog(entityType: string, entityId: string) {
  const result = await queryLogs(100, 0, { entityType });
  return { data: result.data.filter((log: any) => log.entity_id === entityId), error: result.error };
}

export const getAdminActions = (adminId: string, limit = 50, offset = 0) =>
  queryLogs(limit, offset, { actorId: adminId });

export async function getAuditLogStats(days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await queryLogs(200, 0, { startDate });
  if (result.error) return { data: null, error: result.error };
  const actionBreakdown: Record<string, number> = {};
  const entityBreakdown: Record<string, number> = {};
  result.data.forEach((log: any) => {
    actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    entityBreakdown[log.entity_type] = (entityBreakdown[log.entity_type] || 0) + 1;
  });
  return { data: { totalActions: result.total, actionBreakdown, entityBreakdown }, error: null };
}
