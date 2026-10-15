import { useEffect, useState } from 'react';
import { Check, X, Calendar, Share2, FileAudio, Search, ShieldCheck, CheckCircle2, XCircle, Play, Loader2 } from 'lucide-react';
import type { ReleaseSubmission } from '@services/distributionSyncService';
import { apiGet, apiPut } from '@lib/api/client';
import { resolveMediaUrl } from '@/utils/mediaUrl';

export default function ReleasesReview() {
  const [submissions, setSubmissions] = useState<ReleaseSubmission[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelease, setSelectedRelease] = useState<ReleaseSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await apiGet<any>('/api/admin/releases-review?status=all&limit=100');
      let apiSubs: ReleaseSubmission[] = [];
      const dataRows = res.success ? (Array.isArray(res.data) ? res.data : (res.data?.data || [])) : [];

      if (dataRows.length > 0) {
        apiSubs = dataRows.map((ar: any) => {
          const rawStatus = (ar.raw_status || ar.status || '').toUpperCase();
          let status: ReleaseSubmission['status'] = 'submitted';
          if (rawStatus === 'APPROVED') status = 'approved';
          else if (rawStatus === 'REJECTED') status = 'rejected';
          else if (rawStatus === 'PENDING' || rawStatus === 'DRAFT') status = 'submitted';
          else if (rawStatus === 'REVIEW' || rawStatus === 'SUBMITTED') status = 'submitted';
          else if (rawStatus === 'RELEASED' || rawStatus === 'LIVE') status = 'live';

          const trackObj = ar.tracks?.[0] || {};
          const rawAudio = trackObj.audio_url || ar.audio_url || '';
          const rawCover = ar.cover_artwork_url || ar.artwork_url || ar.cover_url || '';

          return {
            id: ar.id,
            title: ar.title,
            release_type: (ar.release_type?.toLowerCase() || 'single') as any,
            artist_name: ar.artist_name || ar.primaryArtist || ar.artist?.artist_name || '',
            genre: ar.genre || '',
            release_date: ar.release_date?.split('T')[0] || (ar.releaseDate ? String(ar.releaseDate).split('T')[0] : ''),
            cover_url: resolveMediaUrl(rawCover),
            audio_url: resolveMediaUrl(rawAudio),
            audio_name: trackObj.title || ar.audio_name || '',
            tiktok_clip_start: trackObj.tiktok_clip_start || ar.tiktok_clip_start || '',
            tiktok_clip_duration: '',
            isrc: trackObj.isrc || '',
            upc: ar.upc || '',
            status,
            rejection_reason: ar.rejection_reason || ar.rejectionReason || '',
            user_id: ar.owner_id || ar.ownerId || '',
            user_name: ar.user_name || ar.owner?.full_name || '',
            user_email: ar.user_email || ar.owner?.email || '',
            created_at: ar.created_at || ar.createdAt || '',
            updated_at: ar.updated_at || ar.updatedAt || '',
          };
        });
      }

      setSubmissions(apiSubs);
    } catch (e) {
      console.warn('Failed to load admin releases:', e);
      setSubmissions([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlayAudio = (item: ReleaseSubmission) => {
    if (!item.audio_url) {
      setActionMsg(`Lagu "${item.title}" tidak memiliki file audio.`);
      setTimeout(() => setActionMsg(''), 4000);
      return;
    }

    window.dispatchEvent(
      new CustomEvent('groovvy-play-track', {
        detail: {
          title: item.title,
          artist: item.artist_name,
          artwork: item.cover_url,
          audioUrl: item.audio_url,
          duration: 210,
        },
      })
    );
  };

  const handleApprove = async (id: string, title: string) => {
    setProcessingId(id);
    try {
      // 1. Update Neon PostgreSQL via Worker Admin endpoint
      await apiPut(`/api/admin/releases-review/${encodeURIComponent(id)}`, {
        status: 'approved',
      });
      setActionMsg(`Rilis "${title}" berhasil disetujui (ACC) & otomatis masuk ke Katalog Musik!`);
      setSelectedRelease(null);
      await loadData();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setActionMsg(`Gagal menyetujui rilis: ${err.message || 'Server error'}`);
    } finally {
      setProcessingId(null);
      setTimeout(() => setActionMsg(''), 5000);
    }
  };

  const handleOpenReject = (release: ReleaseSubmission) => {
    setSelectedRelease(release);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedRelease) return;
    setProcessingId(selectedRelease.id);
    try {
      // 1. Update Neon PostgreSQL via Worker Admin endpoint
      await apiPut(`/api/admin/releases-review/${encodeURIComponent(selectedRelease.id)}`, {
        status: 'rejected',
        reason: rejectReason,
      });
      setActionMsg(`Rilis "${selectedRelease.title}" telah ditolak dengan catatan evaluasi.`);
      setShowRejectModal(false);
      setSelectedRelease(null);
      await loadData();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setActionMsg(`Gagal menolak rilis: ${err.message || 'Server error'}`);
    } finally {
      setProcessingId(null);
      setTimeout(() => setActionMsg(''), 5000);
    }
  };

  const filtered = submissions.filter((s) => {
    const matchesFilter = filterStatus === 'all' || s.status === filterStatus;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 text-white font-sans max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Antrean Review &amp; Kurasi Rilis</h1>
          </div>
          <p className="text-xs text-gray-400">
            Tinjau pengajuan lagu dari artis/user, verifikasi hak cipta, potongan klip TikTok, dan lakukan ACC atau Reject.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
            {submissions.filter(s => s.status === 'submitted' || s.status === 'in_review').length} Menunggu Review
          </span>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-indigo-400" />
          <span className="font-semibold">{actionMsg}</span>
        </div>
      )}

      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
          {[
            { id: 'all', label: 'Semua Rilis' },
            { id: 'submitted', label: 'Menunggu ACC' },
            { id: 'approved', label: 'Disetujui (ACC)' },
            { id: 'rejected', label: 'Ditolak / Revisi' },
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

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari lagu, artis, atau user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#14141B] text-white text-xs pl-9 pr-3.5 py-2 rounded-xl border border-white/[0.07] focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Submission Review List */}
      <div className="space-y-3.5">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-[#14141B] border border-white/[0.06] hover:border-white/[0.15] rounded-3xl p-5 transition-all shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              {/* Left: Metadata */}
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-800 flex-shrink-0 relative border border-white/[0.08]">
                  <img
                    src={item.cover_url || '/images/butterfly-effect.jpg'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/images/butterfly-effect.jpg';
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase">
                      {item.release_type}
                    </span>
                    <span className="text-xs text-gray-400">• {item.genre}</span>
                    <span className="text-xs text-gray-500">• Oleh: <strong className="text-gray-300">{item.user_name}</strong></span>
                  </div>

                  <h3 className="text-base font-extrabold text-white tracking-tight truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs text-indigo-400 font-medium truncate mt-0.5">
                    {item.artist_name}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      Rilis: {item.release_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3 text-pink-400" />
                      Klip TikTok: <strong className="text-white">{item.tiktok_clip_start} ({item.tiktok_clip_duration})</strong>
                    </span>
                    {item.audio_url ? (
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(item)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-500/30"
                        title="Dengarkan file audio master"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Putar Audio Master</span>
                      </button>
                    ) : item.audio_name ? (
                      <span className="flex items-center gap-1 text-gray-500">
                        <FileAudio className="w-3 h-3" />
                        {item.audio_name}
                      </span>
                    ) : null}
                    {item.isrc && (
                      <span className="text-gray-500 font-mono text-[10px]">
                        ISRC: {item.isrc}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions (ACC / Reject) */}
              <div className="flex items-center gap-2.5 self-end lg:self-center">
                {item.status === 'submitted' || item.status === 'in_review' ? (
                  <>
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleApprove(item.id, item.title)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {processingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>ACC / Approve</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleOpenReject(item)}
                      className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                ) : item.status === 'approved' || item.status === 'live' ? (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Telah Di-ACC (Approved)</span>
                  </span>
                ) : (
                  <div className="text-right">
                    <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold inline-flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Ditolak</span>
                    </span>
                    {item.rejection_reason && (
                      <p className="text-[10px] text-rose-400 mt-1 max-w-xs">{item.rejection_reason}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#14141B] border border-white/[0.06] rounded-3xl p-12 text-center text-gray-400 text-xs">
            Tidak ada pengajuan rilis yang sesuai filter.
          </div>
        )}
      </div>

      {/* REJECT MODAL */}
      {showRejectModal && selectedRelease && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161620] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="text-base font-black text-white">Tolak Pengajuan Rilis</h3>
            <p className="text-xs text-gray-400">
              Masukkan alasan penolakan atau instruksi revisi untuk lagu <strong className="text-white">"{selectedRelease.title}"</strong>:
            </p>

            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Artwork buram / audio terdapat noise berlebih..."
              className="w-full bg-[#121218] border border-white/[0.08] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] text-gray-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={confirmReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
