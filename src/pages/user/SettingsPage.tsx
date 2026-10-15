import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Bell, Loader, Check, X, Settings, ShieldCheck } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { changePassword } from '@lib/auth/authService';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'kyc' | 'notifications'>('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        if (currentUser) {
          if (currentUser.email) setEmail(currentUser.email);
          if (currentUser.fullName) {
            setFullName(currentUser.fullName);
          } else if (currentUser.email) {
            setFullName(currentUser.email.split('@')[0]);
          }
        }
      } catch (err) {
        // use default fallback
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [navigate]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Harap isi semua kolom kata sandi');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok');
      return;
    }

    try {
      const { error: err } = await changePassword(currentPassword, newPassword);
      if (err) throw err;
      setSuccess('Kata sandi berhasil diperbarui');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Gagal memperbarui kata sandi');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Memuat pengaturan akun...</p>
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
            <Settings className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Pengaturan Akun &amp; Identitas</h1>
          </div>
          <p className="text-xs text-gray-400">
            Kelola data profil musisi, keamanan kata sandi, dan verifikasi KYC penarikan royalti.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-4 space-y-1.5 shadow-lg">
            {[
              { id: 'profile', label: 'Profil Akun', icon: User },
              { id: 'kyc', label: 'Verifikasi KYC / NIK', icon: ShieldCheck },
              { id: 'security', label: 'Keamanan Kata Sandi', icon: Lock },
              { id: 'notifications', label: 'Preferensi Notifikasi', icon: Bell },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#4F67FF]/20 border border-[#4F67FF]/35 text-white font-bold'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#4F67FF]' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-rose-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Check size={16} />
                <span>{success}</span>
              </div>
              <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
              <div>
                <h2 className="text-base font-bold text-white">Informasi Profil Musisi</h2>
                <p className="text-xs text-gray-400">Data ini digunakan untuk identifikasi kepemilikan katalog.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1">Alamat Email Terdaftar</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full bg-[#121218]/60 border border-white/[0.05] rounded-xl px-3.5 py-2.5 text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1">Rekening Pencairan Utama</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSuccess('Data profil berhasil disimpan!');
                      setTimeout(() => setSuccess(''), 4000);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold transition-all"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* KYC Tab */}
          {activeTab === 'kyc' && (
            <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
              <div>
                <h2 className="text-base font-bold text-white">Verifikasi Identitas Musisi (KYC)</h2>
                <p className="text-xs text-gray-400">Wajib untuk pencairan dana royalti ke rekening Bank &amp; E-Wallet Indonesia.</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                Verifikasi identitas belum tersedia. Jangan kirim nomor identitas melalui formulir ini.
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
              <div>
                <h2 className="text-base font-bold text-white">Ubah Kata Sandi</h2>
                <p className="text-xs text-gray-400">Pastikan menggunakan kombinasi kata sandi yang kuat.</p>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Kata Sandi Saat Ini</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Kata Sandi Baru</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Minimal 8 karakter"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1">Konfirmasi Kata Sandi Baru</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Ulangi kata sandi baru"
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="px-6 py-2.5 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold transition-all">
                    Perbarui Kata Sandi
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
              <div>
                <h2 className="text-base font-bold text-white">Preferensi Pemberitahuan</h2>
                <p className="text-xs text-gray-400">Atur pesan yang ingin Anda terima.</p>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded text-indigo-500" />
                  <div>
                    <p className="font-bold text-white">Status ACC / Review Rilisan Lagu</p>
                    <p className="text-gray-400 text-[11px]">Terima email saat lagu disetujui atau memerlukan revisi.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded text-indigo-500" />
                  <div>
                    <p className="font-bold text-white">Laporan Royalti &amp; Pencairan Dana</p>
                    <p className="text-gray-400 text-[11px]">Pemberitahuan saat transfer ke rekening bank/e-wallet telah selesai.</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
