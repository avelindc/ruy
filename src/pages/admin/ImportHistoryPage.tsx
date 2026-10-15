import { useState, useEffect } from 'react';
import { getImportHistory, getImportErrors } from '@services/importExecutionService';
import { useAuth } from '@hooks/useAuth';

interface Import {
  id: string;
  filename: string;
  source: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_at: string;
  completed_at?: string;
  uploaded_by: string;
}

interface ImportError {
  rowNumber: number;
  errorCode: string;
  errorMessage: string;
  rawRow: string;
}

export default function ImportHistoryPage() {
  const { user } = useAuth();
  const [imports, setImports] = useState<Import[]>([]);
  const [selectedImport, setSelectedImport] = useState<Import | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'errors' | 'details'>('list');

  // Fetch import history
  useEffect(() => {
    if (!user) return;

    const fetchImports = async () => {
      try {
        setLoading(true);
        const result = await getImportHistory(user.id, {
          source: filterSource || undefined,
          status: filterStatus || undefined,
          limit: 50,
        });
        setImports(result.imports);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch imports');
      } finally {
        setLoading(false);
      }
    };

    fetchImports();
  }, [user, filterSource, filterStatus]);

  // Fetch errors for selected import
  const handleSelectImport = async (importRecord: Import) => {
    setSelectedImport(importRecord);
    try {
      const errs = await getImportErrors(importRecord.id);
      setErrors(errs);
      setViewMode('errors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch errors');
    }
  };

  // Download error CSV
  const handleDownloadErrors = () => {
    if (!selectedImport || errors.length === 0) return;

    let csv = 'Row,ErrorCode,ErrorMessage,RawRow\n';
    errors.forEach(err => {
      const rawRow = err.rawRow.replace(/"/g, '""'); // Escape quotes
      csv += `${err.rowNumber},"${err.errorCode}","${err.errorMessage.replace(/"/g, '""')}","${rawRow}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${selectedImport.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Import History</h1>
        <p className="text-gray-600">View and manage CSV imports</p>
      </div>

      {error && (
        <div className="card mb-6 p-4 bg-red-50 border border-red-200">
          <p className="text-red-700"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {viewMode === 'list' && (
        <>
          {/* Filters */}
          <div className="card mb-6 p-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sources</option>
                <option value="spotify">Spotify</option>
                <option value="apple_music">Apple Music</option>
                <option value="youtube">YouTube Music</option>
                <option value="tidal">TIDAL</option>
                <option value="amazon_music">Amazon Music</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Imports Table */}
          {loading ? (
            <div className="card p-8 text-center">
              <div className="inline-block mb-4">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
              <p>Loading imports...</p>
            </div>
          ) : imports.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500">No imports found</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3">Filename</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-right px-4 py-3">Rows</th>
                    <th className="text-right px-4 py-3">Valid</th>
                    <th className="text-right px-4 py-3">Errors</th>
                    <th className="text-right px-4 py-3">Duplicates</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Uploaded By</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-center px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map(imp => (
                    <tr key={imp.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-xs">{imp.filename}</td>
                      <td className="px-4 py-3 capitalize">{imp.source}</td>
                      <td className="px-4 py-3 text-right">{imp.total_rows}</td>
                      <td className="px-4 py-3 text-right text-green-600">{imp.valid_rows}</td>
                      <td className="px-4 py-3 text-right text-red-600">{imp.invalid_rows}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{imp.duplicate_rows}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBadge(imp.status)}`}>
                          {imp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{imp.uploaded_by}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(imp.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSelectImport(imp)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {viewMode === 'errors' && selectedImport && (
        <div>
          {/* Back Button */}
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedImport(null);
              setErrors([]);
            }}
            className="mb-6 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            ← Back to List
          </button>

          {/* Import Details */}
          <div className="card mb-6 p-6">
            <h2 className="text-xl font-bold mb-4">Import: {selectedImport.filename}</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Source</p>
                <p className="font-bold capitalize">{selectedImport.source}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-bold">{selectedImport.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Rows</p>
                <p className="font-bold">{selectedImport.total_rows}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-bold">{new Date(selectedImport.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="card p-4 bg-green-50">
              <p className="text-sm text-gray-600">Valid Rows</p>
              <p className="text-2xl font-bold text-green-600">{selectedImport.valid_rows}</p>
            </div>
            <div className="card p-4 bg-red-50">
              <p className="text-sm text-gray-600">Invalid Rows</p>
              <p className="text-2xl font-bold text-red-600">{selectedImport.invalid_rows}</p>
            </div>
            <div className="card p-4 bg-yellow-50">
              <p className="text-sm text-gray-600">Duplicates</p>
              <p className="text-2xl font-bold text-yellow-600">{selectedImport.duplicate_rows}</p>
            </div>
            <div className="card p-4 bg-blue-50">
              <p className="text-sm text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold text-blue-600">{errors.length}</p>
            </div>
          </div>

          {/* Download Button */}
          {errors.length > 0 && (
            <div className="mb-6">
              <button
                onClick={handleDownloadErrors}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ↓ Download Error CSV
              </button>
            </div>
          )}

          {/* Errors Table */}
          {errors.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-green-600 font-bold">✓ No errors found!</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3">Row</th>
                    <th className="text-left px-4 py-3">Error Code</th>
                    <th className="text-left px-4 py-3">Message</th>
                    <th className="text-left px-4 py-3">Raw Row</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{err.rowNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs font-bold">{err.errorCode}</td>
                      <td className="px-4 py-3">{err.errorMessage}</td>
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-xs" title={err.rawRow}>
                        {err.rawRow}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
