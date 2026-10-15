import { useEffect, useState } from 'react';
import { CreditCard, Check, X, CheckCircle2, XCircle, Building2, Smartphone, Search } from 'lucide-react';
import { getAdminWithdrawalRequests, updateAdminWithdrawal, type WithdrawalRecord } from '@services/withdrawalService';

export default function WithdrawalsManagement() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedWd, setSelectedWd] = useState<WithdrawalRecord | null>(null);
  const [refNo, setRefNo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [modalMode, setModalMode] = useState<'pay' | 'reject' | null>(null);

  const loadData = async () => {
    const result = await getAdminWithdrawalRequests(filterStatus);
    if (result.error) setErrorMsg(result.error.message);
    else setWithdrawals(result.data);
  };

  useEffect(() => {
    void loadData();
  }, [filterStatus]);

  const handleOpenPay = (wd: WithdrawalRecord) => {
    setSelectedWd(wd);
    setRefNo('');
    setModalMode('pay');
  };

  const handleOpenReject = (wd: WithdrawalRecord) => {
    setSelectedWd(wd);
    setRejectReason('');
    setModalMode('reject');
  };

  const confirmPay = async () => {
    if (!selectedWd || !refNo.trim()) return;
    const result = await updateAdminWithdrawal(selectedWd.id, 'paid', refNo.trim());
    if (result.error) { setErrorMsg(result.error.message); return; }
    setSuccessMsg(`Withdrawal for ${selectedWd.user_name} ($${selectedWd.amount.toFixed(2)} ${selectedWd.currency}) marked as paid.`);
    setModalMode(null);
    setSelectedWd(null);
    await loadData();
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const confirmReject = async () => {
    if (!selectedWd || !rejectReason.trim()) return;
    const result = await updateAdminWithdrawal(selectedWd.id, 'rejected', rejectReason.trim());
    if (result.error) { setErrorMsg(result.error.message); return; }
    setSuccessMsg(`Withdrawal request for ${selectedWd.user_name} was rejected.`);
    setModalMode(null);
    setSelectedWd(null);
    await loadData();
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const filtered = withdrawals.filter((w) => {
    const matchesFilter = filterStatus === 'all' || w.status === filterStatus;
    const matchesSearch =
      w.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.account_number.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const totalPending = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-6 text-white font-sans max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Manajemen Penarikan Saldo (Bank &amp; E-Wallet)</h1>
          </div>
          <p className="text-xs text-gray-400">
            Verifikasi transfer penarikan royalti artis ke Bank BCA, Mandiri, BRI, BNI dan E-Wallet DANA, GoPay, OVO.
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Menunggu Pencairan</span>
          <p className="text-xl font-black text-amber-400">
            ${totalPending.toFixed(2)} USD
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}
      {errorMsg && <p role="alert" className="text-sm text-rose-300">{errorMsg}</p>}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'pending', label: 'Perlu Transfer' },
            { id: 'paid', label: 'Sudah Ditransfer' },
            { id: 'rejected', label: 'Ditolak' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === tab.id
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'bg-[#14141B] text-gray-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama artis, bank, rekening..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#14141B] text-white text-xs pl-9 pr-3.5 py-2 rounded-xl border border-white/[0.07] focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((w) => (
            <div
              key={w.id}
              className="bg-[#14141B] border border-white/[0.06] hover:border-white/[0.15] rounded-3xl p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                  {w.method_type === 'bank' ? (
                    <Building2 className="w-6 h-6 text-indigo-400" />
                  ) : (
                    <Smartphone className="w-6 h-6 text-emerald-400" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-white">{w.channel}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/[0.06] text-gray-400 uppercase">
                      {w.method_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 font-mono">
                    {w.account_number} a.n <strong className="text-white">{w.account_name}</strong>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    User: {w.user_name} • Diajukan: {new Date(w.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-white/[0.06]">
                <div className="text-right">
                  <p className="text-lg font-black text-white">
                    ${w.amount.toFixed(2)} {w.currency}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {w.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleOpenPay(w)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Tandai Sudah Ditransfer (Mark Paid)</span>
                      </button>
                      <button
                        onClick={() => handleOpenReject(w)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </>
                  ) : w.status === 'paid' ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sudah Ditransfer ({w.reference_no})</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Ditolak ({w.rejection_reason})</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#14141B] border border-white/[0.06] rounded-3xl p-12 text-center text-gray-500 text-xs">
            Tidak ada permohonan penarikan dana.
          </div>
        )}
      </div>

      {/* CONFIRM PAY MODAL */}
      {modalMode === 'pay' && selectedWd && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161620] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="text-base font-black text-white">Konfirmasi Transfer Royalti</h3>
            <p className="text-xs text-gray-300">
              Pastikan Anda telah mentransfer <strong className="text-emerald-400">${selectedWd.amount.toFixed(2)} {selectedWd.currency}</strong> ke:
            </p>

            <div className="bg-[#121218] p-3 rounded-xl border border-white/[0.08] text-xs space-y-1">
              <p><strong className="text-gray-400">Tujuan:</strong> {selectedWd.channel}</p>
              <p><strong className="text-gray-400">No Rek/HP:</strong> <span className="font-mono text-white font-bold">{selectedWd.account_number}</span></p>
              <p><strong className="text-gray-400">Atas Nama:</strong> {selectedWd.account_name}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300">Nomor Referensi Transfer / Bukti TRX *</label>
              <input
                type="text"
                required
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setModalMode(null)} className="px-4 py-2 rounded-xl bg-white/[0.06] text-gray-300 text-xs font-semibold">
                Batal
              </button>
              <button onClick={confirmPay} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                Tandai Berhasil Ditransfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {modalMode === 'reject' && selectedWd && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161620] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="text-base font-black text-white">Tolak Penarikan Saldo</h3>
            <p className="text-xs text-gray-400">
              Alasan penolakan akan dikirimkan kepada user:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-[#121218] border border-white/[0.08] rounded-xl p-3 text-xs text-white"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setModalMode(null)} className="px-4 py-2 rounded-xl bg-white/[0.06] text-gray-300 text-xs font-semibold">
                Batal
              </button>
              <button onClick={confirmReject} className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">
                Tolak Penarikan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
