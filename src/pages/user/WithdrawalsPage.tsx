import { useEffect, useState } from 'react';
import { Wallet, Clock, CheckCircle2, XCircle, AlertCircle, ArrowUpRight, Building2, Smartphone, X, CreditCard, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { getWithdrawalRequests, getWalletInfo, createWithdrawalRequest, type WithdrawalRecord } from '@services/withdrawalService';

export default function WithdrawalsPage() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [totals, setTotals] = useState({ balance: 0, total_earned: 0, total_withdrawn: 0 });
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [methodType, setMethodType] = useState<'bank' | 'ewallet'>('bank');
  const [channel, setChannel] = useState('Bank Central Asia (BCA)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState<number>(0);

  const indonesianBanks = [
    'Bank Central Asia (BCA)',
    'Bank Mandiri',
    'Bank Negara Indonesia (BNI)',
    'Bank Rakyat Indonesia (BRI)',
    'Bank Syariah Indonesia (BSI)',
    'Bank Permata',
    'CIMB Niaga',
    'Bank Danamon',
  ];

  const indonesianEwallets = [
    'DANA',
    'GoPay',
    'OVO',
    'ShopeePay',
    'LinkAja',
  ];

  const loadData = async () => {
    if (!user) return;
    const [withdrawalResult, walletResult] = await Promise.all([
      getWithdrawalRequests(user.id),
      getWalletInfo(user.id),
    ]);
    if (withdrawalResult.error) setErrorMsg(withdrawalResult.error.message);
    else setWithdrawals(withdrawalResult.data);
    if (walletResult.error) setErrorMsg(walletResult.error.message);
    else if (walletResult.data) setTotals(walletResult.data);
    if (!accountName && user.fullName) setAccountName(user.fullName);
  };

  useEffect(() => {
    loadData();
    void loadData();
  }, [user]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (amount < 50) {
      setErrorMsg('Minimum withdrawal is USD 50.');
      return;
    }

    if (amount > totals.balance) {
      setErrorMsg('Nominal penarikan melebihi saldo yang tersedia.');
      return;
    }

    if (!accountNumber || !accountName) {
      setErrorMsg('Mohon lengkapi nomor dan nama pemilik rekening/akun e-wallet.');
      return;
    }

    const payout = await createWithdrawalRequest(user?.id || '', {
      amount,
      currency: 'USD',
      payout_method: methodType,
      payout_reference: JSON.stringify({ method_type: methodType, channel, account_number: accountNumber, account_name: accountName }),
    });
    if (payout.error) { setErrorMsg(payout.error.message); return; }

    setSuccessMsg(`Withdrawal request for $${amount.toFixed(2)} to ${channel} was submitted.`);
    setShowModal(false);
    setAccountNumber('');
    await loadData();
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  return (
    <div className="space-y-6 text-white font-sans w-full max-w-7xl mx-auto pb-12 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Tarik Saldo Royalti (Withdraw)</h1>
          </div>
          <p className="text-xs text-gray-400">
            Pencairan pendapatan royalti musik langsung ke rekening Bank &amp; E-Wallet Indonesia (BCA, Mandiri, BRI, BNI, DANA, GoPay, OVO, ShopeePay).
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] text-white text-xs font-bold transition-all shadow-[0_8px_20px_rgba(79,103,255,0.4)] hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Ajukan Penarikan Baru</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Saldo Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="bg-[#14141B] border border-white/[0.08] p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Saldo Tersedia untuk Ditarik</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            ${totals.balance.toFixed(2)} USD
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Available from finalized royalty records.
          </p>
        </div>

        {/* Total Earned */}
        <div className="bg-[#14141B] border border-white/[0.08] p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Total Akumulasi Royalti</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            ${totals.total_earned.toFixed(2)} USD
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Dari streaming Spotify, TikTok, Apple Music</p>
        </div>

        {/* Total Withdrawn */}
        <div className="bg-[#14141B] border border-white/[0.08] p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Total Sudah Dicairkan</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            ${totals.total_withdrawn.toFixed(2)} USD
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Masuk ke Bank &amp; E-Wallet Indonesia</p>
        </div>
      </div>

      {/* Withdrawal History */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white px-1">Riwayat Permintaan Penarikan Dana</h2>

        <div className="space-y-3">
          {withdrawals.length > 0 ? (
            withdrawals.map((wd) => {
              const statusMap = ({
                pending: { label: 'Menunggu Verifikasi Admin', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
                approved: { label: 'Disetujui Admin (Proses Transfer)', bg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20', icon: Clock },
                paid: { label: 'Berhasil Masuk Rekening / Wallet', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
                rejected: { label: 'Ditolak', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: XCircle },
              } as Record<string, { label: string; bg: string; icon: LucideIcon }>)[wd.status] || { label: wd.status, bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: AlertCircle };

              const StatusIcon = statusMap.icon;

              return (
                <div
                  key={wd.id}
                  className="bg-[#14141B] border border-white/[0.06] hover:border-white/[0.15] rounded-3xl p-5 transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      {wd.method_type === 'bank' ? (
                        <Building2 className="w-6 h-6 text-indigo-400" />
                      ) : (
                        <Smartphone className="w-6 h-6 text-emerald-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-white">{wd.channel}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.06] text-gray-400 uppercase">
                          {wd.method_type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono">
                        {wd.account_number} a.n <strong className="text-gray-200">{wd.account_name}</strong>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Diajukan: {new Date(wd.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex flex-col sm:items-end justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-white">
                        ${wd.amount.toFixed(2)} {wd.currency}
                      </p>
                    </div>

                    <span className={`px-3 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 self-start sm:self-auto ${statusMap.bg}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusMap.label}</span>
                    </span>

                    {wd.reference_no && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Ref No: {wd.reference_no}
                      </span>
                    )}
                    {wd.rejection_reason && (
                      <span className="text-[10px] text-rose-400">
                        Alasan: {wd.rejection_reason}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-[#14141B] border border-white/[0.06] rounded-3xl p-10 text-center text-gray-500 text-xs">
              Belum ada riwayat penarikan dana.
            </div>
          )}
        </div>
      </div>

      {/* WITHDRAWAL MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161620] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h2 className="text-lg font-black text-white">Pencairan Dana Royalti</h2>
                <p className="text-xs text-gray-400">Pilih bank transfer atau e-wallet Indonesia tujuan.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
              {/* Method Switcher: Bank vs E-Wallet */}
              <div className="grid grid-cols-2 gap-2 bg-[#121218] p-1.5 rounded-2xl border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setMethodType('bank');
                    setChannel(indonesianBanks[0]);
                  }}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    methodType === 'bank'
                      ? 'bg-[#4F67FF] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Bank Indonesia</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethodType('ewallet');
                    setChannel(indonesianEwallets[0]);
                  }}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    methodType === 'ewallet'
                      ? 'bg-[#4F67FF] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>E-Wallet Indonesia</span>
                </button>
              </div>

              {/* Channel Selector */}
              <div className="space-y-1">
                <label className="font-bold text-gray-300">
                  {methodType === 'bank' ? 'Pilih Bank Tujuan' : 'Pilih E-Wallet Tujuan'}
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {(methodType === 'bank' ? indonesianBanks : indonesianEwallets).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Account Number */}
              <div className="space-y-1">
                <label className="font-bold text-gray-300">
                  {methodType === 'bank' ? 'Nomor Rekening Bank' : 'Nomor HP Akun E-Wallet'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={methodType === 'bank' ? 'Contoh: 8271920192' : 'Contoh: 081298765432'}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Account Name */}
              <div className="space-y-1">
                <label className="font-bold text-gray-300">Nama Lengkap Pemilik Rekening / Akun *</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="font-bold text-gray-300">Withdrawal amount (USD) *</label>
                  <button
                    type="button"
                    onClick={() => setAmount(totals.balance)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    Withdraw all available (${totals.balance.toFixed(2)})
                  </button>
                </div>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="50"
                  max={totals.balance}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono text-base font-bold focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Minimum withdrawal: USD 50.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] text-gray-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold shadow-lg"
                >
                  Ajukan Penarikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
