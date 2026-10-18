import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Settings, TrendingUp, History, ArrowRight } from 'lucide-react';
import { apiGet, apiPost } from '@lib/api/client';

interface ArtistOption { id: string; artist_name: string }
interface RoyaltyRule { id: string; artist_id: string; artist_name: string; platform: string; share_percent: number; revenue_basis: string; currency: string; effective_from: string; effective_until?: string }
interface ImportRow { id: string; source: string; filename: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; created_at: string }

export default function RoyaltiesManagement() {
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [rules, setRules] = useState<RoyaltyRule[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [artistId, setArtistId] = useState('');
  const [platform, setPlatform] = useState('');
  const [share, setShare] = useState('');
  const [basis, setBasis] = useState<'gross' | 'net'>('net');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [artistResponse, ruleResponse, importResponse] = await Promise.all([
        apiGet<any>('/api/artists?limit=100'),
        apiGet<any>('/api/admin/royalty-rules'),
        apiGet<any>('/api/admin/csv-import?limit=100'),
      ]);
      if (!artistResponse.success || !ruleResponse.success || !importResponse.success) {
        throw new Error(artistResponse.error || ruleResponse.error || importResponse.error || 'Failed to load royalty management data.');
      }
      const artistRows = artistResponse.data?.data || [];
      setArtists(artistRows);
      setRules(ruleResponse.data || []);
      setImports(importResponse.data?.data || []);
      if (!artistId && artistRows[0]?.id) setArtistId(artistRows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load royalty management data.');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const createRule = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await apiPost<RoyaltyRule>('/api/admin/royalty-rules', {
        artist_id: artistId, platform, share_percent: Number(share), revenue_basis: basis,
        currency: 'USD', effective_from: effectiveFrom, effective_until: effectiveUntil || null,
      });
      if (!response.success) throw new Error(response.error || 'Could not create royalty rule.');
      setNotice('Aturan royalti berhasil disimpan.');
      setPlatform('');
      setShare('');
      setEffectiveUntil('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create royalty rule.');
    } finally {
      setSaving(false);
    }
  };

  const processReport = async (report: ImportRow) => {
    setProcessingId(report.id);
    setError('');
    setNotice('');
    try {
      const response = await apiPost<{ batchId: string }>(`/api/admin/csv-import/${encodeURIComponent(report.id)}/royalties`, {});
      if (!response.success) throw new Error(response.error || 'Royalty report could not be processed.');
      setNotice(`Royalty batch ${response.data?.batchId || ''} selesai diproses.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Royalty report could not be processed.');
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 text-white font-sans">
      {/* 1. Header Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-4">
        <Link
          to="/admin/streaming-royalty"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#FF6A3D] text-white shadow-lg shadow-[#FF6A3D]/25 hover:bg-[#ff7a52] transition-all"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Input Streaming (Aktual)</span>
        </Link>
        <Link
          to="/admin/streaming-royalty?tab=royalty"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#FF6A3D] text-white shadow-lg shadow-[#FF6A3D]/25 hover:bg-[#ff7a52] transition-all"
        >
          <Coins className="w-4 h-4" />
          <span>Input Royalty (Aktual)</span>
        </Link>
        <Link
          to="/admin/streaming-royalty?tab=history"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white transition-all"
        >
          <History className="w-4 h-4" />
          <span>Riwayat Data</span>
        </Link>
        <Link
          to="/admin/royalties"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border border-purple-500/50 bg-purple-600/30 text-purple-200 shadow-sm transition-all"
        >
          <Settings className="w-4 h-4 text-purple-400" />
          <span>Konfigurasi Aturan Royalti (Rule Setup)</span>
        </Link>
      </div>

      {/* 2. Prominent Callout Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-500/15 via-[#181920] to-purple-500/15 border border-orange-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#FF6A3D]" />
            <span>Memasukkan Angka Streaming atau Nominal Royalti Baru?</span>
          </p>
          <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
            Halaman ini khusus untuk mengatur persentase pembagian royalti per platform. Untuk memasukkan jumlah streaming aktual atau nominal royalti artis (secara manual atau kalkulasi otomatis), gunakan halaman <strong>Input Streaming &amp; Royalty</strong>.
          </p>
        </div>
        <Link
          to="/admin/streaming-royalty"
          className="px-5 py-2.5 rounded-xl bg-[#FF6A3D] hover:bg-[#ff7a52] text-white text-xs font-bold transition-all shadow-lg shadow-[#FF6A3D]/30 shrink-0 flex items-center gap-2"
        >
          <span>Buka Input Streaming &amp; Royalty</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-black text-white tracking-tight mb-1">Konfigurasi Aturan Royalti (Royalty Rules)</h1>
        <p className="text-xs text-gray-400">Atur persentase bagi hasil artis per platform sebelum memproses laporan streaming validasi. Tidak ada tarif default otomatis tanpa aturan resmi.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 text-xs font-semibold">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 text-xs font-semibold">{notice}</div>}

      {/* 3. Rule Form */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#181920] p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight">Atur Aturan Pembagian Royalti Baru</h2>
        {artists.length === 0 ? (
          <p className="text-xs text-gray-400">Belum ada akun artis yang terdaftar untuk dikonfigurasi.</p>
        ) : (
          <form onSubmit={createRule} className="grid gap-4 md:grid-cols-3 text-xs">
            <label className="grid gap-1.5 font-semibold text-gray-300">
              Artis
              <select
                required
                value={artistId}
                onChange={(event) => setArtistId(event.target.value)}
                className="rounded-xl border border-white/[0.1] bg-[#101116] p-2.5 text-white focus:outline-none focus:border-indigo-500"
              >
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>{artist.artist_name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 font-semibold text-gray-300">
              Platform (Harus cocok dengan laporan)
              <input
                required
                maxLength={80}
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                placeholder="spotify, apple_music, youtube..."
                className="rounded-xl border border-white/[0.1] bg-[#101116] p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="grid gap-1.5 font-semibold text-gray-300">
              Bagian Artis / Share (%)
              <input
                required
                type="number"
                min="0.0001"
                max="100"
                step="0.0001"
                value={share}
                onChange={(event) => setShare(event.target.value)}
                placeholder="Contoh: 70"
                className="rounded-xl border border-white/[0.1] bg-[#101116] p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="grid gap-1.5 font-semibold text-gray-300">
              Basis Pendapatan (Revenue Basis)
              <select
                value={basis}
                onChange={(event) => setBasis(event.target.value as 'gross' | 'net')}
                className="rounded-xl border border-white/[0.1] bg-[#101116] p-2.5 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="net">Net revenue (Setelah potongan DSP)</option>
                <option value="gross">Gross revenue (Pendapatan kotor)</option>
              </select>
            </label>
            <label className="grid gap-1.5 font-semibold text-gray-300">
              Berlaku Mulai (Effective from)
              <input
                required
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                className="rounded-xl border border-white/[0.1] bg-[#101116] p-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="grid gap-1.5 font-semibold text-gray-300">
              Berlaku Sampai (Opsional)
              <input
                type="date"
                value={effectiveUntil}
                onChange={(event) => setEffectiveUntil(event.target.value)}
                className="rounded-xl border border-white/[0.1] bg-[#101116] p-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </label>
            <div className="md:col-span-3 pt-2">
              <button
                disabled={saving}
                className="rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] px-6 py-2.5 text-white font-bold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
              >
                {saving ? 'Menyimpan Aturan...' : 'Simpan Aturan Royalti'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 4. Configured Rules Table */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#181920] overflow-hidden shadow-xl">
        <div className="border-b border-white/[0.08] p-5">
          <h2 className="text-base font-bold text-white tracking-tight">Daftar Aturan Royalti Aktif</h2>
        </div>
        {loading ? (
          <div className="p-6 text-xs text-gray-400">Memuat daftar aturan...</div>
        ) : rules.length === 0 ? (
          <div className="p-6 text-xs text-gray-400">Belum ada aturan yang dikonfigurasi. Pemrosesan royalti otomatis membutuhkan minimal satu aturan bagi hasil per platform.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-gray-400 bg-white/[0.02]">
                  <th className="p-4 font-semibold">Artis</th>
                  <th className="p-4 font-semibold">Platform</th>
                  <th className="p-4 font-semibold">Share</th>
                  <th className="p-4 font-semibold">Basis</th>
                  <th className="p-4 font-semibold">Mata Uang</th>
                  <th className="p-4 font-semibold">Periode Berlaku</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-bold text-white">{rule.artist_name}</td>
                    <td className="p-4 uppercase font-semibold text-indigo-300">{rule.platform}</td>
                    <td className="p-4 font-mono font-bold text-emerald-400">{rule.share_percent}%</td>
                    <td className="p-4 capitalize text-gray-300">{rule.revenue_basis}</td>
                    <td className="p-4 text-gray-300">{rule.currency}</td>
                    <td className="p-4 text-gray-400 font-mono">{rule.effective_from} – {rule.effective_until || 'ongoing'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Streaming Reports Ingestion Table */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#181920] overflow-hidden shadow-xl">
        <div className="border-b border-white/[0.08] p-5">
          <h2 className="text-base font-bold text-white tracking-tight">Laporan Streaming Impor CSV</h2>
          <p className="mt-1 text-xs text-gray-400">Hanya laporan berstatus valid tanpa baris bermasalah yang dapat diproses menjadi royalti.</p>
        </div>
        {loading ? (
          <div className="p-6 text-xs text-gray-400">Memuat laporan...</div>
        ) : imports.length === 0 ? (
          <div className="p-6 text-xs text-gray-400">Belum ada file impor laporan CSV.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-gray-400 bg-white/[0.02]">
                  <th className="p-4 font-semibold">Sumber / File</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Jumlah Baris</th>
                  <th className="p-4 font-semibold">Tanggal Impor</th>
                  <th className="p-4 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((report) => (
                  <tr key={report.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-white block">{report.source}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{report.filename}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        report.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">{report.valid_rows} valid / {report.invalid_rows} reject</td>
                    <td className="p-4 text-gray-400 font-mono">{new Date(report.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      {report.status === 'completed' && (
                        <button
                          disabled={processingId === report.id || report.invalid_rows > 0 || rules.length === 0}
                          onClick={() => void processReport(report)}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-white font-bold transition-all shadow-md disabled:opacity-40"
                        >
                          {processingId === report.id ? 'Memproses...' : 'Proses Royalti'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
