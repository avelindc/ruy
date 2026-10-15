import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Disc3,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Upload,
  Calendar,
  Share2,
  FileAudio,
  Image as ImageIcon,
  Sparkles,
  Search,
  X,
  Loader2,
  RotateCcw,
  Edit3,
  Play
} from 'lucide-react';
import { resolveMediaUrl } from '@utils/mediaUrl';
import type { ReleaseSubmission } from '@services/distributionSyncService';
import { useAuth } from '@contexts/AuthContext';
import { getUserArtists, createArtist } from '@services/artistService';
import {
  getUserReleases,
  createRelease,
  updateRelease,
  submitReleaseForReview,
  uploadReleaseFile
} from '@services/releaseService';

interface UserArtist {
  id: string;
  name: string;
}

export default function ReleasesPage() {
  const { user: currentUser } = useAuth();
  const [releases, setReleases] = useState<ReleaseSubmission[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [userArtists, setUserArtists] = useState<UserArtist[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [releaseType, setReleaseType] = useState<'single' | 'ep' | 'album'>('single');
  const [isNewArtist, setIsNewArtist] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [releaseDate, setReleaseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Cover Artwork Upload State
  const [coverUrl, setCoverUrl] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverVerified, setCoverVerified] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [coverProgress, setCoverProgress] = useState(0);
  const [coverStorageProvider, setCoverStorageProvider] = useState<'r2' | 'database_chunks' | ''>('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Master Audio Upload State
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [audioFileSize, setAudioFileSize] = useState('');
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioVerified, setAudioVerified] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioStorageProvider, setAudioStorageProvider] = useState<'r2' | 'database_chunks' | ''>('');
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [tiktokStart, setTiktokStart] = useState('00:30');
  const [tiktokDuration, setTiktokDuration] = useState('30s');
  const [isrc, setIsrc] = useState('');

  const genresList = [
    'Pop',
    'Hip Hop / Rap',
    'Electronic / Dance',
    'R&B / Soul',
    'Rock / Metal',
    'Alternative / Indie',
    'Dangdut / Koplo',
    'Acoustic / Folk',
    'Jazz / Blues',
    'Classical',
  ];

  const resetForm = () => {
    setTitle('');
    setReleaseType('single');
    setGenre('Pop');
    setCoverUrl('');
    setCoverUploading(false);
    setCoverProgress(0);
    setCoverVerified(false);
    setCoverError('');
    setCoverStorageProvider('');
    setAudioUrl('');
    setAudioName('');
    setAudioFileSize('');
    setAudioProgress(0);
    setAudioUploading(false);
    setAudioVerified(false);
    setAudioError('');
    setAudioStorageProvider('');
    setIsrc('');
    setTiktokStart('00:30');
    setTiktokDuration('30s');
    setEditingDraftId(null);
    setErrorMsg('');
  };

  const loadData = async () => {
    try {
      const user = currentUser;
      if (user) {
        // Load real artists
        const { data: artists } = await getUserArtists(user.id);
        if (artists && artists.length > 0) {
          const mappedArtists = artists.map((a: any) => ({
            id: a.id,
            name: a.artist_name || a.name || '',
          }));
          setUserArtists(mappedArtists);
          if (!selectedArtistId) {
            setSelectedArtistId(mappedArtists[0].id);
            setArtistName(mappedArtists[0].name);
          }
        } else {
          setIsNewArtist(true);
        }

        // Load real releases from API for this authenticated user
        const { data: apiReleases } = await getUserReleases(user.id);
        const combined: ReleaseSubmission[] = [];

        if (apiReleases && Array.isArray(apiReleases)) {
          apiReleases.forEach((ar: any) => {
            // Strictly ensure release belongs to this user
            if (ar.owner_id && ar.owner_id !== user.id) return;

            const rawStatus = (ar.status || '').toLowerCase();
            let status: ReleaseSubmission['status'] = 'submitted';
            if (rawStatus === 'pending' || rawStatus === 'draft') {
              status = 'draft' as any;
            } else if (rawStatus === 'approved') {
              status = 'approved';
            } else if (rawStatus === 'rejected') {
              status = 'rejected';
            } else if (rawStatus === 'released' || rawStatus === 'live') {
              status = 'live';
            } else {
              status = 'submitted';
            }

            const trackObj = ar.tracks?.[0] || {};

            combined.push({
              id: ar.id,
              title: ar.title,
              release_type: (ar.release_type?.toLowerCase() || 'single') as any,
              artist_name: ar.artist?.artist_name || ar.artist?.name || ar.primaryArtist || '',
              genre: ar.genre || '',
              release_date: ar.release_date?.split('T')[0] || '',
              cover_url: resolveMediaUrl(ar.cover_artwork_url || ar.artwork_url || ar.cover_url || ''),
              audio_name: '',
              audio_url: resolveMediaUrl(trackObj.audio_url || ''),
              tiktok_clip_start: trackObj.tiktok_clip_start || '',
              tiktok_clip_duration: '',
              isrc: trackObj.isrc || '',
              upc: ar.upc || '',
              status,
              user_id: user.id,
              user_name: user.fullName || user.email?.split('@')[0] || '',
              user_email: user.email || '',
              created_at: ar.created_at || '',
              updated_at: ar.updated_at || '',
            } as any);
          });
        }

        setReleases(combined);
      } else {
        setReleases([]);
      }
    } catch (e) {
      console.warn('Error loading releases:', e);
      setReleases([]);
    }
  };

  const handlePlayAudio = (track: { title: string; artist_name?: string; cover_url?: string; audio_url?: string }) => {
    const resolvedAudio = resolveMediaUrl(track.audio_url);
    const resolvedCover = resolveMediaUrl(track.cover_url);
    if (!resolvedAudio) {
      alert('File audio master belum tersedia untuk rilis ini.');
      return;
    }
    window.dispatchEvent(
      new CustomEvent('groovvy-play-track', {
        detail: {
          title: track.title,
          artist: track.artist_name || '',
          album: track.title,
          cover_url: resolvedCover || '/images/butterfly-effect.jpg',
          audio_url: resolvedAudio,
        },
      })
    );
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Lock body scroll on iOS/Safari and mobile browsers when submission modal is active
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showModal]);

  // Handle Cover Upload directly to verified storage
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverError('');
    setCoverUploading(true);
    setCoverProgress(0);
    setCoverVerified(false);

    try {
      const { data, error } = await uploadReleaseFile(file, 'artwork', (pct) => {
        setCoverProgress(pct);
      });
      if (error || !data) {
        throw new Error(error?.message || 'Gagal mengunggah file artwork.');
      }

      setCoverUrl(data.url);
      setCoverVerified(data.verified);
      setCoverStorageProvider(data.storage);
      setCoverProgress(100);
    } catch (err: any) {
      console.error('Cover upload failed:', err);
      setCoverError(err.message || 'Gagal mengunggah cover artwork. Coba lagi.');
      setCoverVerified(false);
    } finally {
      setCoverUploading(false);
    }
  };

  // Handle Audio Master Upload directly to verified storage
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioError('');
    setAudioUploading(true);
    setAudioProgress(0);
    setAudioVerified(false);
    setAudioName(file.name);

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setAudioFileSize(`${sizeMb} MB`);

    try {
      const { data, error } = await uploadReleaseFile(file, 'audio', (pct) => {
        setAudioProgress(pct);
      });
      if (error || !data) {
        throw new Error(error?.message || 'Gagal mengunggah master audio.');
      }

      setAudioUrl(data.url);
      setAudioVerified(data.verified);
      setAudioStorageProvider(data.storage);
      setAudioProgress(100);
    } catch (err: any) {
      console.error('Audio upload failed:', err);
      setAudioError(err.message || 'Gagal mengunggah file audio master. Coba lagi.');
      setAudioVerified(false);
    } finally {
      setAudioUploading(false);
    }
  };

  // Save as Draft (Allows saving incomplete releases)
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setErrorMsg('Judul lagu wajib diisi untuk menyimpan draft.');
      return;
    }

    setSavingDraft(true);
    setErrorMsg('');
    try {
      if (!currentUser?.id) throw new Error('Sesi login tidak valid. Silakan masuk kembali.');
      const uId = currentUser.id;

      // 1. Resolve artist ID
      let finalArtistId = selectedArtistId;
      if (isNewArtist && artistName.trim() && currentUser?.id) {
        const { data: newArtist, error: artistError } = await createArtist(currentUser.id, {
          artist_name: artistName.trim(),
          genre: genre,
          country: 'Indonesia',
        });
        if (artistError || !newArtist?.id) throw artistError || new Error('Gagal menyimpan profil artis.');
        if (newArtist?.id) {
          finalArtistId = newArtist.id;
        }
      }
      if (!finalArtistId) throw new Error('Pilih atau buat profil artis sebelum menyimpan rilis.');

      const releasePayload: any = {
        title: title.trim(),
        release_type: releaseType,
        primary_artist_id: finalArtistId || undefined,
        genre: genre,
        release_date: releaseDate,
        artwork_url: coverUrl || '',
        cover_artwork_url: coverUrl || '',
        status: 'draft',
        tracks: audioName ? [{
          title: title.trim(),
          audio_url: audioUrl || '',
          isrc: isrc.trim() || undefined,
        }] : [],
      };

      if (editingDraftId) {
        await updateRelease(editingDraftId, releasePayload);
      } else {
        await createRelease(uId, releasePayload);
      }

      setSuccessMsg('Draft rilis berhasil disimpan! Anda dapat melengkapi file master audio/cover kapan saja.');
      setShowModal(false);
      resetForm();
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Save draft error:', err);
      setErrorMsg(err.message || 'Gagal menyimpan draft rilis.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Final Submit for Review (Strict verification enforced)
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Judul lagu / rilis wajib diisi.');
      return;
    }

    if (!coverUrl || !coverVerified) {
      setErrorMsg('Cover Artwork wajib diunggah dan terverifikasi di storage sebelum mengajukan rilis.');
      return;
    }

    if (!audioUrl || !audioVerified) {
      setErrorMsg('File Master Audio wajib diunggah dan terverifikasi di storage sebelum mengajukan rilis.');
      return;
    }

    setSubmitting(true);
    try {
      if (!currentUser?.id) throw new Error('Sesi login tidak valid. Silakan masuk kembali.');
      const uId = currentUser.id;

      // 1. Resolve artist ID
      let finalArtistId = selectedArtistId;
      if (isNewArtist && artistName.trim() && currentUser?.id) {
        const { data: newArtist, error: artistError } = await createArtist(currentUser.id, {
          artist_name: artistName.trim(),
          genre: genre,
          country: 'Indonesia',
        });
        if (artistError || !newArtist?.id) throw artistError || new Error('Gagal menyimpan profil artis.');
        if (newArtist?.id) {
          finalArtistId = newArtist.id;
        }
      }
      if (!finalArtistId) throw new Error('Pilih atau buat profil artis sebelum mengajukan rilis.');

      const suppliedIsrc = isrc.trim() || undefined;

      // 2. Ensure release exists as draft first
      let targetReleaseId = editingDraftId;
      if (!targetReleaseId) {
        const { data: newRel, error: createErr } = await createRelease(uId, {
          title: title.trim(),
          release_type: releaseType,
          primary_artist_id: finalArtistId || undefined,
          genre: genre,
          release_date: releaseDate,
          artwork_url: coverUrl,
          cover_artwork_url: coverUrl,
          tracks: [{
            title: title.trim(),
            audio_url: audioUrl,
            isrc: suppliedIsrc,
          }],
        });

        if (createErr || !newRel?.id) {
          throw new Error(createErr?.message || 'Gagal membuat rilis di database.');
        }
        targetReleaseId = newRel.id;
      } else {
        await updateRelease(targetReleaseId, {
          title: title.trim(),
          genre: genre,
          artwork_url: coverUrl,
          tracks: [{
            title: title.trim(),
            audio_url: audioUrl,
            isrc: suppliedIsrc,
          }],
        });
      }

      // 3. Final submission with verified storage check on backend
      const { error: submitErr } = await submitReleaseForReview(targetReleaseId!);
      if (submitErr) {
        throw new Error(submitErr.message);
      }

      setSuccessMsg('Rilis lagu dan master audio berhasil diverifikasi dan dikirim ke Admin untuk ditinjau!');
      setShowModal(false);
      resetForm();
      setTimeout(() => setSuccessMsg(''), 6000);
      await loadData();
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMsg(err.message || 'Gagal mengajukan rilis untuk ditinjau.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open modal to edit existing draft
  const handleEditDraft = (rel: ReleaseSubmission) => {
    resetForm();
    setEditingDraftId(rel.id);
    setTitle(rel.title);
    setReleaseType((rel.release_type as any) || 'single');
    setGenre(rel.genre || 'Pop');
    setReleaseDate(rel.release_date || new Date().toISOString().split('T')[0]);
    if (rel.cover_url) {
      setCoverUrl(rel.cover_url);
      setCoverVerified(true);
    }
    if ((rel as any).audio_url) {
      setAudioUrl((rel as any).audio_url);
      setAudioName(rel.audio_name || 'master_audio.mp3');
      setAudioVerified(true);
    }
    setArtistName(rel.artist_name || '');
    setShowModal(true);
  };

  const filteredReleases = releases.filter((r) => {
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.artist_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 text-white font-sans w-full max-w-7xl mx-auto pb-12 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Disc3 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Rilis Lagu (Music Distribution)</h1>
          </div>
          <p className="text-xs text-gray-400">
            Submit rilis lagu baru ke 150+ platform streaming global (Spotify, Apple Music, TikTok, YouTube).
          </p>
        </div>

        <button
          type="button"
          id="btn-buat-rilis-baru"
          onClick={() => {
            try {
              resetForm();
            } catch (err) {
              console.error('Error in resetForm:', err);
            }
            setShowModal(true);
          }}
          className="px-5 py-3 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] active:bg-[#394ee5] text-white text-xs font-bold transition-all shadow-[0_8px_20px_rgba(79,103,255,0.4)] hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer self-start sm:self-auto touch-manipulation select-none relative z-10"
        >
          <Plus className="w-4 h-4 pointer-events-none" />
          <span className="pointer-events-none">Buat Rilis Baru</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Controls & Status Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
          {[
            { id: 'all', label: 'Semua Rilis' },
            { id: 'draft', label: 'Draft / Belum Submit' },
            { id: 'submitted', label: 'Terkirim / Review' },
            { id: 'approved', label: 'Disetujui / ACC' },
            { id: 'live', label: 'Live di Platform' },
            { id: 'rejected', label: 'Perlu Revisi / Ditolak' },
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

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari judul lagu atau artis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#14141B] text-white text-xs pl-9 pr-3.5 py-2 rounded-xl border border-white/[0.07] focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Release List */}
      <div className="space-y-3">
        {filteredReleases.length > 0 ? (
          filteredReleases.map((release) => {
            const isDraft = (release.status as string) === 'draft' || (release.status as string) === 'pending';

            const statusConfig = {
              draft: { label: 'Draft (Belum Diajukan)', bg: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20', icon: Clock },
              submitted: { label: 'Menunggu ACC Admin', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
              in_review: { label: 'Sedang Direview Admin', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: Clock },
              approved: { label: 'Disetujui (Approved)', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
              live: { label: 'Live di 150+ Platform', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/20', icon: Sparkles },
              rejected: { label: 'Ditolak / Perlu Revisi', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: XCircle },
            }[release.status] || { label: release.status, bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: AlertCircle };

            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={release.id}
                className="bg-[#14141B] border border-white/[0.06] hover:border-white/[0.15] rounded-3xl p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Left: Artwork & Details */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-800 flex-shrink-0 relative border border-white/[0.08]">
                    <img
                      src={resolveMediaUrl(release.cover_url) || '/images/butterfly-effect.jpg'}
                      alt={release.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/butterfly-effect.jpg';
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-gray-300">
                        {release.release_type}
                      </span>
                      <span className="text-xs text-gray-400">• {release.genre}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-white tracking-tight truncate">
                      {release.title}
                    </h3>
                    <p className="text-xs text-indigo-400 font-medium truncate mt-0.5">
                      {release.artist_name}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        Rilis: {release.release_date}
                      </span>
                      {release.audio_name && (
                        <span className="flex items-center gap-1">
                          <FileAudio className="w-3 h-3 text-indigo-400" />
                          {release.audio_name}
                        </span>
                      )}
                      {release.isrc && (
                        <span className="font-mono text-gray-500">
                          ISRC: {release.isrc}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status Badge & Actions */}
                <div className="flex flex-col md:items-end justify-between gap-2.5 border-t md:border-t-0 pt-3 md:pt-0 border-white/[0.06]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${statusConfig.bg}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusConfig.label}</span>
                    </div>

                    {release.audio_url && (
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(release)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Putar master audio di pemutar musik Breakout"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
                        <span>Putar Audio</span>
                      </button>
                    )}

                    {isDraft && (
                      <button
                        onClick={() => handleEditDraft(release)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Lengkapi &amp; Kirim</span>
                      </button>
                    )}
                  </div>

                  {/* Rejection reason warning */}
                  {release.status === 'rejected' && release.rejection_reason && (
                    <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl max-w-sm">
                      <strong>Catatan Admin:</strong> {release.rejection_reason}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[#14141B] border border-white/[0.06] rounded-3xl p-12 text-center">
            <Disc3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white">Belum Ada Rilis Lagu</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Mulai distribusikan karya musik Anda ke Spotify, TikTok, dan platform global dengan menekan tombol Buat Rilis Baru.
            </p>
            <button
              type="button"
              id="btn-submit-lagu-sekarang"
              onClick={() => {
                try {
                  resetForm();
                } catch (err) {
                  console.error('Error in resetForm:', err);
                }
                setShowModal(true);
              }}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] active:bg-[#394ee5] text-white text-xs font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer touch-manipulation select-none"
            >
              Submit Lagu Sekarang
            </button>
          </div>
        )}
      </div>

      {/* SUBMISSION MODAL: Music Distribution Form rendered via Portal to document.body for iOS & mobile browser reliability */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div
          id="release-modal-overlay"
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div
            className="bg-[#161620] border border-white/[0.1] rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar animate-scaleUp relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">
                  {editingDraftId ? 'Lengkapi Draft Rilis Musik' : 'Formulir Rilis Lagu Baru'}
                </h2>
                <p className="text-xs text-gray-400">
                  Lengkapi data dan upload file master audio serta cover artwork untuk verifikasi kurasi.
                </p>
              </div>
              <button
                type="button"
                id="btn-close-release-modal"
                onClick={() => setShowModal(false)}
                aria-label="Tutup formulir"
                className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.15] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer touch-manipulation flex-shrink-0"
              >
                <X className="w-4 h-4 pointer-events-none" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleFinalSubmit} className="space-y-5 text-xs">
              {/* Row 1: Title & Release Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-gray-300">Judul Lagu / Rilis *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Satu Rasa (Single)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-300">Tipe Rilis</label>
                  <select
                    value={releaseType}
                    onChange={(e: any) => setReleaseType(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Artist (Existing or Create New) */}
              <div className="space-y-2 bg-[#121218] border border-white/[0.06] p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-300">Artis Utama (Primary Artist)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewArtist(!isNewArtist);
                      if (!isNewArtist) setArtistName('');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    {isNewArtist ? '← Pilih dari Artis yang Ada' : '+ Buat Artis Baru (Create New Artist)'}
                  </button>
                </div>

                {isNewArtist ? (
                  <input
                    type="text"
                    required
                    placeholder="Masukkan nama artis/band baru..."
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    className="w-full bg-[#161622] border border-indigo-500/40 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                ) : (
                  <select
                    value={selectedArtistId}
                    onChange={(e) => {
                      setSelectedArtistId(e.target.value);
                      const art = userArtists.find(a => a.id === e.target.value);
                      if (art) setArtistName(art.name);
                    }}
                    className="w-full bg-[#161622] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {userArtists.length > 0 ? (
                      userArtists.map((art) => (
                        <option key={art.id} value={art.id}>{art.name}</option>
                      ))
                    ) : (
                      <option value="">(Belum ada artis - klik buat baru)</option>
                    )}
                  </select>
                )}
              </div>

              {/* Row 3: Genre & Release Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-300">Genre Musik</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {genresList.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-300">Tanggal Rilis Global</label>
                  <input
                    type="date"
                    required
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 4: TikTok Audio Clip / Social Preview Start Time */}
              <div className="bg-[#121218] border border-white/[0.06] p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-pink-400" />
                  <label className="font-bold text-gray-300">
                    Potongan Klip TikTok &amp; Reels Preview
                  </label>
                </div>
                <p className="text-[11px] text-gray-400">
                  Tentukan bagian terbaik lagu (chorus/hook) yang akan otomatis menjadi sound default di TikTok dan Instagram Reels.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-500 block mb-1">Mulai Dari (Menit:Detik)</span>
                    <input
                      type="text"
                      placeholder="00:30"
                      value={tiktokStart}
                      onChange={(e) => setTiktokStart(e.target.value)}
                      className="w-full bg-[#161622] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block mb-1">Durasi Klip</span>
                    <select
                      value={tiktokDuration}
                      onChange={(e) => setTiktokDuration(e.target.value)}
                      className="w-full bg-[#161622] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white font-mono"
                    >
                      <option value="30s">30 Detik</option>
                      <option value="60s">60 Detik</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 5: Upload MP3/WAV/M4A & Cover Art with verified storage feedback */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cover Art Upload */}
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Cover Artwork (1:1) *</span>
                    </span>
                    {coverVerified && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Terverifikasi
                      </span>
                    )}
                  </label>

                  <div className="border-2 border-dashed border-white/[0.1] hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-[#121218] min-h-[135px] relative overflow-hidden transition-all">
                    {coverUploading ? (
                      <div className="w-full flex flex-col items-center gap-2 text-indigo-400 py-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-semibold">Mengunggah gambar... {coverProgress}%</span>
                        <div className="w-36 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${coverProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : coverError ? (
                      <div className="flex flex-col items-center gap-2 text-rose-400 py-1">
                        <XCircle className="w-6 h-6" />
                        <span className="text-[11px] max-w-xs">{coverError}</span>
                        <label
                          htmlFor="cover-artwork-input"
                          className="mt-1 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Coba Upload Lagi</span>
                        </label>
                      </div>
                    ) : coverUrl ? (
                      <div className="flex items-center gap-3 w-full justify-center">
                        <img
                          src={resolveMediaUrl(coverUrl)}
                          alt="Preview"
                          className="w-14 h-14 rounded-xl object-cover border border-white/10 shadow-md flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/butterfly-effect.jpg';
                          }}
                        />
                        <div className="text-left min-w-0">
                          <span className="text-emerald-400 text-xs font-bold block">✓ Tersimpan di Storage</span>
                          <span className="text-[10px] text-gray-500 block truncate max-w-[130px]">
                            {coverStorageProvider === 'r2' ? 'Cloudflare R2' : 'Verified Storage'}
                          </span>
                          <label
                            htmlFor="cover-artwork-input"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline mt-1 inline-block cursor-pointer font-medium"
                          >
                            Ganti Cover
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="cover-artwork-input"
                        className="cursor-pointer flex flex-col items-center py-2 w-full h-full"
                      >
                        <Upload className="w-5 h-5 text-gray-500 mb-1" />
                        <span className="text-gray-200 font-bold text-xs">Pilih File Cover</span>
                        <span className="text-[10px] text-gray-500 mt-0.5">JPG, PNG, WebP (Maks. 15MB)</span>
                        <span className="text-[9px] text-indigo-400/80 mt-1">Buka dari Galeri / Files</span>
                      </label>
                    )}

                    <input
                      id="cover-artwork-input"
                      ref={coverInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,image/*"
                      onChange={handleCoverUpload}
                      onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                      className={!coverUrl && !coverUploading && !coverError ? "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" : "sr-only"}
                      title="Pilih cover artwork"
                    />
                  </div>
                </div>

                {/* Audio MP3/WAV/M4A Upload */}
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileAudio className="w-3.5 h-3.5 text-indigo-400" />
                      <span>File Master Audio *</span>
                    </span>
                    {audioVerified && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Terverifikasi
                      </span>
                    )}
                  </label>

                  <div className="border-2 border-dashed border-white/[0.1] hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-[#121218] min-h-[135px] relative overflow-hidden transition-all">
                    {audioUploading ? (
                      <div className="w-full flex flex-col items-center gap-2 text-indigo-400 py-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-semibold">Mengunggah master audio... {audioProgress}%</span>
                        <div className="w-36 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${audioProgress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 truncate max-w-xs">{audioName} {audioFileSize ? `(${audioFileSize})` : ''}</span>
                      </div>
                    ) : audioError ? (
                      <div className="flex flex-col items-center gap-2 text-rose-400 py-1">
                        <XCircle className="w-6 h-6" />
                        <span className="text-[11px] max-w-xs">{audioError}</span>
                        <label
                          htmlFor="audio-master-file-input"
                          className="mt-1 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Coba Upload Lagi</span>
                        </label>
                      </div>
                    ) : audioUrl ? (
                      <div className="flex items-center gap-3 w-full justify-center">
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                          <FileAudio className="w-6 h-6" />
                        </div>
                        <div className="text-left min-w-0">
                          <span className="text-white text-xs font-bold block truncate max-w-[150px]" title={audioName}>
                            {audioName || 'audio_master.mp3'}
                          </span>
                          <span className="text-[10px] text-emerald-400 block font-medium">
                            ✓ {audioStorageProvider === 'r2' ? 'Cloudflare R2' : 'Verified Storage'} {audioFileSize ? `• ${audioFileSize}` : ''}
                          </span>
                          <div className="flex items-center gap-3 mt-1">
                            <label
                              htmlFor="audio-master-file-input"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer font-medium"
                            >
                              Ganti File Audio
                            </label>
                            <button
                              type="button"
                              onClick={() => handlePlayAudio({
                                title: title || audioName || 'Preview Master Audio',
                                artist_name: artistName || 'Artis',
                                cover_url: coverUrl,
                                audio_url: audioUrl,
                              })}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                              title="Dengarkan file audio yang diunggah"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>Tes Putar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="audio-master-file-input"
                        className="cursor-pointer flex flex-col items-center py-2 w-full h-full"
                      >
                        <Upload className="w-5 h-5 text-gray-500 mb-1" />
                        <span className="text-gray-200 font-bold text-xs">Pilih Master Audio</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">MP3, WAV, M4A, AAC, FLAC</span>
                        <span className="text-[9px] text-indigo-400/80 mt-1">Buka dari iPhone / Android Files</span>
                      </label>
                    )}

                    {/* Native File Input positioned directly over dropzone for iOS Safari & Android native file picker */}
                    <input
                      id="audio-master-file-input"
                      ref={audioInputRef}
                      type="file"
                      accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/mp4,audio/aac,audio/flac,audio/*"
                      onChange={handleAudioUpload}
                      onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                      className={!audioUrl && !audioUploading && !audioError ? "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" : "sr-only"}
                      title="Pilih file audio master dari Files atau perangkat"
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: ISRC (Optional) */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-300">Kode ISRC (Opsional, masukkan kode resmi jika tersedia)</label>
                <input
                  type="text"
                  placeholder="Contoh: ID-XXX-26-00001"
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value)}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 font-semibold transition-all order-3 sm:order-1 text-center"
                >
                  Batal
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 order-1 sm:order-2">
                  {/* Button 1: Save Draft (Partial uploads allowed) */}
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold transition-all border border-white/[0.1] disabled:opacity-50"
                  >
                    {savingDraft ? 'Menyimpan Draft...' : 'Simpan Sebagai Draft'}
                  </button>

                  {/* Button 2: Final Submit for Review (Cover & Audio Strictly Required) */}
                  <button
                    type="submit"
                    disabled={submitting || savingDraft || coverUploading || audioUploading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold transition-all shadow-[0_8px_20px_rgba(79,103,255,0.4)] disabled:opacity-50"
                  >
                    {submitting ? 'Memverifikasi & Mengirim...' : 'Kirim Rilis ke Admin (Submit)'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
