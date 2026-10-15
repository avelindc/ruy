import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, AlertCircle, Calendar, User } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { getAuditLogs, searchAuditLogs } from '@services/auditLogService';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  actor?: { full_name: string };
}

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const pageSize = 25;

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        setError('');

        const user = await getCurrentUser();
        if (!user) {
          return;
        }

        const offset = page * pageSize;

        let result: any;
        if (searchQuery) {
          result = await searchAuditLogs(searchQuery, pageSize, offset);
        } else {
          result = await getAuditLogs(pageSize, offset, {
            action: actionFilter || undefined,
            entityType: entityFilter || undefined,
          });
        }

        if (result.error) throw result.error;

        setLogs(result.data || []);
        setTotal(result.total || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audit logs';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [navigate, page, searchQuery, actionFilter, entityFilter]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  const actionTypes = [...new Set(logs.map(l => l.action))];
  const entityTypes = [...new Set(logs.map(l => l.entity_type))];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600">Administrator actions and platform changes</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search action or entity..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Actions</option>
            {actionTypes.map(action => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>

          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={e => {
              setEntityFilter(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Entities</option>
            {entityTypes.map(entity => (
              <option key={entity} value={entity}>
                {entity.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Timestamp</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Actor</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Action</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Entity</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-4 px-6 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <div>
                          <p className="font-medium">{new Date(log.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <span className="text-gray-900 font-medium">{log.actor?.full_name || 'System'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <span className="text-gray-900 font-medium">{log.entity_type}</span>
                      {log.entity_id && (
                        <p className="text-xs text-gray-500 font-mono mt-1">{log.entity_id.substring(0, 8)}...</p>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {log.metadata ? (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:text-blue-800 font-medium">
                            View
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-600">
                            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                          </div>
                        </details>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No audit logs found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-gray-600 text-sm">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} logs
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
