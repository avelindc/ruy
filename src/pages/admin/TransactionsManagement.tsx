import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@lib/api/client';

interface LedgerRow {
  id: string;
  user_name: string;
  entry_type: string;
  amount: number;
  currency: string;
  reference_type: string;
  reference_id: string;
  description: string;
  created_at: string;
}

export default function TransactionsManagement() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiGet<any>('/api/admin/financial-ledger?limit=200');
      if (!response.success) throw new Error(response.error || 'Failed to load financial ledger.');
      setRows(response.data?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load financial ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLedger(); }, [loadLedger]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Transactions Management</h1>
          <p className="text-gray-500">Append-only financial ledger from royalty credits and withdrawal events.</p>
        </div>
        <button onClick={() => void loadLedger()} disabled={loading} className="rounded-lg border px-4 py-2 disabled:opacity-50">Refresh</button>
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>}
      <div className="card overflow-x-auto">
        {loading ? <div className="p-8 text-center text-gray-500">Loading ledger…</div>
          : rows.length === 0 ? <div className="p-8 text-center text-gray-500">No ledger entries have been recorded.</div>
            : <table className="w-full min-w-[850px] text-left text-sm">
              <thead><tr className="border-b text-gray-500">
                <th className="p-4">Account</th><th className="p-4">Entry</th><th className="p-4">Description</th>
                <th className="p-4">Reference</th><th className="p-4">Date</th><th className="p-4 text-right">Amount</th>
              </tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0">
                <td className="p-4">{row.user_name}</td>
                <td className="p-4 font-mono text-xs">{row.entry_type.replace(/_/g, ' ')}</td>
                <td className="p-4">{row.description || '—'}</td>
                <td className="p-4 font-mono text-xs">{row.reference_type}: {row.reference_id}</td>
                <td className="p-4">{new Date(row.created_at).toLocaleString()}</td>
                <td className={`p-4 text-right font-semibold ${row.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {row.amount < 0 ? '−' : '+'}{Math.abs(Number(row.amount)).toFixed(2)} {row.currency}
                </td>
              </tr>)}</tbody>
            </table>}
      </div>
    </div>
  );
}
