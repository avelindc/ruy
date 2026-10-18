import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, History, DollarSign } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { getWalletTransactions, getWalletInfo } from '@services/withdrawalService';

interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'refund' | 'adjustment';
  amount: number;
  balance_after?: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState({ balance: 0, total_earned: 0, total_withdrawn: 0 });
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'refund' | 'adjustment'>('all');

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError('');

        const user = await getCurrentUser();
        if (!user) {
          return;
        }

        const [transactionResult, walletResult] = await Promise.all([
          getWalletTransactions(user.id, 100),
          getWalletInfo(user.id),
        ]);
        if (transactionResult.error) throw transactionResult.error;
        if (walletResult.error) throw walletResult.error;
        if (walletResult.data) setWallet(walletResult.data);
        setTransactions(transactionResult.data.map((entry: any) => ({
          id: entry.id,
          user_id: entry.user_id,
          type: entry.entry_type === 'royalty_credit' ? 'deposit'
            : entry.entry_type === 'adjustment_credit' ? 'adjustment'
            : entry.entry_type === 'withdrawal_release' ? 'refund' : 'withdrawal',
          amount: Number(entry.amount || 0),
          description: entry.description || entry.entry_type.replaceAll('_', ' '),
          reference_id: entry.reference_id,
          created_at: entry.created_at,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wallet activity');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [navigate]);

  const filteredTransactions =
    typeFilter === 'all' ? transactions : transactions.filter(t => t.type === typeFilter);

  const getTransactionIcon = (type: string) => {
    const isInflow = type === 'deposit' || type === 'refund';
    return isInflow ? (
      <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
    ) : (
      <ArrowUpRight className="w-4 h-4 text-rose-400" />
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Memuat riwayat transaksi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white font-sans w-full max-w-7xl mx-auto pb-12 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Riwayat Transaksi &amp; Dompet</h1>
          </div>
          <p className="text-xs text-gray-400">
            Log seluruh mutasi saldo royalti, penarikan dana ke rekening Bank &amp; E-Wallet Indonesia.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/withdrawals')}
          className="px-5 py-3 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] text-white text-xs font-bold transition-all shadow-[0_8px_20px_rgba(79,103,255,0.4)] hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <DollarSign className="w-4 h-4" />
          <span>Ajukan Penarikan Baru</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-[#14141B] border border-white/[0.08] p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-semibold">Total Pendapatan Royalti</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400">
            ${wallet.total_earned.toFixed(2)} USD
          </p>
        </div>

        <div className="bg-[#14141B] border border-white/[0.08] p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-semibold">Total Dana Ditarik</p>
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400">
            ${wallet.total_withdrawn.toFixed(2)} USD
          </p>
        </div>

        <div className="bg-[#14141B] border border-white/[0.08] p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-semibold">Saldo Tersedia</p>
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">
            ${wallet.balance.toFixed(2)} USD
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-white">Mutasi Transaksi Dompet</h2>
          <div className="flex flex-wrap gap-2">
            {(['all', 'deposit', 'withdrawal', 'refund', 'adjustment'] as const).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  typeFilter === type
                    ? 'bg-white text-black font-bold'
                    : 'bg-[#14141B] text-gray-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {type === 'all' ? 'Semua' : type}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-xs">
            Belum ada data transaksi yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Tipe</th>
                  <th className="py-3 px-3">Deskripsi Transaksi</th>
                  <th className="py-3 px-3">No. Referensi</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.type)}
                        <span className="font-semibold text-white capitalize">{tx.type}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-gray-300 font-medium">{tx.description}</td>
                    <td className="py-3.5 px-3 text-gray-400 font-mono text-[11px]">{tx.reference_id || tx.id}</td>
                    <td className="py-3.5 px-3 text-gray-400 font-mono">{new Date(tx.created_at).toLocaleDateString('id-ID')}</td>
                    <td className={`py-3.5 px-3 text-right font-extrabold ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
