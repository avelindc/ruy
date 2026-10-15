import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Search, Play, Plus, MoreVertical, Calendar, ChevronLeft, ChevronRight, ExternalLink, Edit3, X, Sparkles, Disc3, Music2, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { getUserReleases } from '@services/releaseService';
import { getStreamingRecords } from '@services/analyticsService';
import { getRoyaltyEntries } from '@services/royaltiesService';
import { useAuth } from '@contexts/AuthContext';

export interface CatalogReleaseItem {
  id: string;
  title: string;
  artist: string;
  release_title: string;
  release_type: 'single' | 'ep' | 'album';
  isrc: string;
  upc: string;
  release_date: string;
  raw_date: string;
  status: 'published' | 'processing' | 'pending' | 'rejected';
  cover_url: string;
  platforms: string[];
  streams: number;
  royalties_usd: number;
  genre: string;
  duration: string;
  rejection_reason?: string;
  is_latest?: boolean;
}

export default function CatalogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [catalogList, setCatalogList] = useState<CatalogReleaseItem[]>([]);
  const [, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Published' | 'Processing' | 'Pending' | 'Rejected'>('All');
  const [platformFilter] = useState<'All' | 'Spotify' | 'Apple Music' | 'YouTube Music' | 'TikTok'>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'streams' | 'royalties'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modals state
  const [detailModalItem, setDetailModalItem] = useState<CatalogReleaseItem | null>(null);
  const [editModalItem, setEditModalItem] = useState<CatalogReleaseItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Dropdown menu state
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Load genuine user catalog data
  const loadUserData = async () => {
    try {
      setLoading(true);

      if (!user) { setCatalogList([]); return; }
      const [releasesResult, streamingResult, royaltiesResult] = await Promise.all([
        getUserReleases(user.id),
        getStreamingRecords(user.id),
        getRoyaltyEntries(user.id),
      ]);
      const apiReleases = releasesResult.data || [];
      const streamingRecords = streamingResult.data || [];
      const royaltyRecords = royaltiesResult.data || [];
      const combined: CatalogReleaseItem[] = [];
      (apiReleases || []).forEach((rel: any) => {
        if (!rel) return;
        const trackIds = new Set((rel.tracks || []).map((track: any) => track.id));
        const matchingStreams = streamingRecords.filter((record: any) => record.release_id === rel.id || trackIds.has(record.track_id));
        const totalStreams = matchingStreams.reduce((sum: number, sr: any) => sum + (sr.streams || 0), 0);
        const totalRoyalty = royaltyRecords.filter((entry: any) => entry.song_name?.trim().toLowerCase() === String(rel.title || '').trim().toLowerCase())
          .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
        const rawStatus = String(rel.status || '').toLowerCase();
        const mappedStatus = rawStatus === 'live' || rawStatus === 'released' ? 'published'
          : rawStatus === 'approved' || rawStatus === 'in_review' || rawStatus === 'submitted' ? 'processing'
          : rawStatus === 'rejected' ? 'rejected' : 'pending';
        const releaseDate = rel.release_date?.split('T')[0] || '';
        const track = rel.tracks?.[0];
        combined.push({
          id: rel.id,
          title: rel.title || '',
          artist: rel.artist?.artist_name || rel.primary_artist?.artist_name || '',
          release_title: rel.title || '',
          release_type: (rel.release_type || 'single') as any,
          isrc: track?.isrc || '',
          upc: rel.upc || '',
          release_date: releaseDate,
          raw_date: releaseDate,
          status: mappedStatus,
          cover_url: rel.artwork_url || '',
          platforms: Array.from(new Set(matchingStreams.map((record: any) => record.platform).filter(Boolean))),
          streams: totalStreams,
          royalties_usd: totalRoyalty,
          genre: rel.genre || '',
          duration: track?.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '',
          is_latest: false,
        });
      });

      // Sort by newest date
      combined.sort((a, b) => new Date(b.raw_date || 0).getTime() - new Date(a.raw_date || 0).getTime());
      if (combined.length > 0) {
        combined[0].is_latest = true;
      }

      setCatalogList(combined);
    } catch (e) {
      console.error('Error loading user catalog:', e);
      setCatalogList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUserData();
  }, [user]);

  // Audio player trigger
  const playTrack = (track: CatalogReleaseItem) => {
    if (!track) return;
    window.dispatchEvent(
      new CustomEvent('groovvy-play-track', {
        detail: {
          title: track.title,
          artist: track.artist,
          album: track.release_title,
          artwork: track.cover_url || '',
        },
      })
    );
  };

  // Status metrics calculation (strictly real numbers)
  const statusCounts = useMemo(() => {
    const list = catalogList || [];
    const published = list.filter(c => c.status === 'published').length;
    const processing = list.filter(c => c.status === 'processing').length;
    const pending = list.filter(c => c.status === 'pending').length;
    const rejected = list.filter(c => c.status === 'rejected').length;
    const total = list.length;

    const publishedPct = total > 0 ? Math.round((published / total) * 100) : 0;
    const processingPct = total > 0 ? Math.round((processing / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
    const rejectedPct = total > 0 ? Math.round((rejected / total) * 100) : 0;

    return {
      total,
      published,
      processing,
      pending,
      rejected,
      publishedPct,
      processingPct,
      pendingPct,
      rejectedPct,
    };
  }, [catalogList]);

  // Donut chart data for Catalog Overview
  const donutData = useMemo(() => {
    if (statusCounts.total === 0) return [];
    return [
      { name: 'Published', value: statusCounts.published, color: '#FF6A3D' },
      { name: 'Processing', value: statusCounts.processing, color: '#8B5CF6' },
      { name: 'Pending', value: statusCounts.pending, color: '#EC4899' },
      { name: 'Rejected', value: statusCounts.rejected, color: '#EF4444' },
    ].filter(item => item.value > 0);
  }, [statusCounts]);

  // Real Release Activity by Month
  const releaseActivityData = useMemo(() => {
    if (catalogList.length === 0) return [];

    const monthMap: Record<string, { month: string; tracks: number; albums: number }> = {};
    catalogList.forEach(item => {
      const d = item.raw_date || item.release_date;
      const mo = d ? d.slice(0, 7) : '';
      if (!mo) return;
      if (!monthMap[mo]) {
        monthMap[mo] = {
          month: mo.slice(5),
          tracks: 0,
          albums: 0,
        };
      }
      if (item.release_type === 'album' || item.release_type === 'ep') {
        monthMap[mo].albums += 1;
      } else {
        monthMap[mo].tracks += 1;
      }
    });

    return Object.values(monthMap);
  }, [catalogList]);

  // Featured and recent releases
  const featuredRelease = useMemo(() => {
    if (catalogList.length > 0) {
      return catalogList.find(c => c.is_latest) || catalogList[0];
    }
    return null;
  }, [catalogList]);

  // Top releases by real streams
  const topReleasesByStreams = useMemo(() => {
    const listWithStreams = catalogList.filter(c => (c.streams || 0) > 0);
    return listWithStreams.sort((a, b) => b.streams - a.streams).slice(0, 5);
  }, [catalogList]);

  // Filter and sort All Releases table
  const filteredReleases = useMemo(() => {
    return (catalogList || []).filter((item) => {
      if (!item) return false;
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch =
        (item.title || '').toLowerCase().includes(q) ||
        (item.artist || '').toLowerCase().includes(q) ||
        (item.isrc || '').toLowerCase().includes(q) ||
        (item.upc || '').toLowerCase().includes(q);

      const itemStatus = (item.status || '').toLowerCase();
      const matchesStatus =
        statusFilter === 'All' ||
        itemStatus === statusFilter.toLowerCase();

      const itemPlatforms = Array.isArray(item.platforms) ? item.platforms : [];
      const matchesPlatform =
        platformFilter === 'All' ||
        itemPlatforms.some((p: string) => (p || '').toLowerCase().includes(platformFilter.toLowerCase()));

      return matchesSearch && matchesStatus && matchesPlatform;
    }).sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.raw_date || 0).getTime() - new Date(a.raw_date || 0).getTime();
      if (sortOrder === 'oldest') return new Date(a.raw_date || 0).getTime() - new Date(b.raw_date || 0).getTime();
      if (sortOrder === 'streams') return (b.streams || 0) - (a.streams || 0);
      if (sortOrder === 'royalties') return (b.royalties_usd || 0) - (a.royalties_usd || 0);
      return 0;
    });
  }, [catalogList, searchQuery, statusFilter, platformFilter, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredReleases.length / itemsPerPage));
  const paginatedReleases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReleases.slice(start, start + itemsPerPage);
  }, [filteredReleases, currentPage]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedReleases.length && paginatedReleases.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedReleases.map(r => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Handle Edit Metadata Submission
  const handleSaveMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalItem) return;

    if (editModalItem.status === 'published') {
      setToastMsg('Rilis yang sudah live di DSP tidak dapat diubah langsung. Hubungi label support.');
      setTimeout(() => setToastMsg(''), 4000);
      setEditModalItem(null);
      return;
    }

    setCatalogList(prev => (prev || []).map(item => {
      if (item.id === editModalItem.id) {
        return {
          ...item,
          title: editTitle || item.title,
          genre: editGenre || item.genre,
        };
      }
      return item;
    }));

    setToastMsg(`Metadata rilisan "${editTitle || editModalItem.title}" berhasil diperbarui.`);
    setTimeout(() => setToastMsg(''), 4000);
    setEditModalItem(null);
  };

  return (
    <div className="text-white font-sans w-full max-w-[1600px] mx-auto space-y-6 pb-16">

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e1f25] border border-purple-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* =========================================================================
          PAGE HEADER
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Katalog Musik
          </h1>
          <p className="text-xs sm:text-sm text-[#8E92A0] mt-1">
            Kelola rilisan, pantau status distribusi, dan riwayat streaming karya Anda.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard/releases')}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF6A3D] to-[#FF8C61] hover:opacity-95 text-white text-xs font-bold transition-all shadow-[0_6px_20px_rgba(255,106,61,0.35)] hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>+ Rilis Lagu Baru</span>
        </button>
      </div>

      {/* =========================================================================
          ROW 1: My Catalog (6 cols) + Catalog Overview (6 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* LEFT: My Catalog (Featured Release & Summary) */}
        <div className="lg:col-span-6 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-semibold text-[#8E92A0]">Katalog Saya</span>
              <div className="text-2xl font-black text-white tracking-tight mt-0.5">
                {statusCounts.total} Track Terdaftar
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard/releases')}
              className="p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
              title="Tambah rilis"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {featuredRelease ? (
            <div className="bg-[#141419] border border-white/[0.04] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 my-2">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-purple-900/20 border border-white/[0.06] flex-shrink-0 flex items-center justify-center text-purple-400 shadow-md">
                {featuredRelease.cover_url ? (
                  <img
                    src={featuredRelease.cover_url}
                    alt={featuredRelease.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Disc3 className="w-8 h-8" />
                )}
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/20 text-[#FF6A3D] uppercase font-mono">
                  Rilisan Terbaru
                </span>
                <h4 className="text-sm font-bold text-white truncate mt-1">
                  {featuredRelease.title}
                </h4>
                <p className="text-xs text-[#8E92A0] truncate">
                  {featuredRelease.artist} • {featuredRelease.release_type.toUpperCase()}
                </p>
                <p className="text-[10px] font-mono text-gray-500 mt-1">
                  ISRC: {featuredRelease.isrc || 'Belum terbit'}
                </p>
              </div>

              <button
                onClick={() => playTrack(featuredRelease)}
                className="w-10 h-10 rounded-full bg-white text-black hover:bg-purple-100 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                title="Putar Lagu"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>
          ) : (
            /* Empty state for featured release */
            <div className="bg-[#141419]/50 border border-dashed border-white/[0.06] rounded-2xl p-6 text-center my-2">
              <Music2 className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-white">Belum Ada Rilis Lagu</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Katalog musik Anda masih kosong. Daftarkan lagu baru untuk didistribusikan ke Spotify, Apple Music, dan 150+ platform streaming.
              </p>
            </div>
          )}

          {/* Quick Stats Footer */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.04] text-center">
            <div>
              <span className="text-[10px] text-[#8E92A0] block">Live di DSP</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {statusCounts.published}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#8E92A0] block">Dalam Review</span>
              <span className="text-base font-extrabold text-purple-400 font-mono">
                {statusCounts.processing}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#8E92A0] block">Draft / Pending</span>
              <span className="text-base font-extrabold text-orange-400 font-mono">
                {statusCounts.pending}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Catalog Overview (Status Donut & Breakdown) */}
        <div className="lg:col-span-6 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white tracking-tight">Status Katalog</h3>
            <span className="text-[11px] font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              Distribusi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto">
            {/* Donut Chart */}
            <div className="sm:col-span-5 relative w-36 h-36 mx-auto flex items-center justify-center">
              {donutData.length === 0 ? (
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-center p-2">
                  <span className="text-base font-bold text-gray-500">0 Rilis</span>
                  <span className="text-[9px] text-gray-500">Belum ada rilis</span>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`donut-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-black text-white">{statusCounts.total}</span>
                    <span className="text-[9px] text-gray-400">Total Rilis</span>
                  </div>
                </>
              )}
            </div>

            {/* Status Breakdown Legend */}
            <div className="sm:col-span-7 space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF6A3D]" />
                  <span className="text-gray-300">Published / Live</span>
                </div>
                <span className="font-mono font-bold text-white">{statusCounts.published} ({statusCounts.publishedPct}%)</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                  <span className="text-gray-300">In Review / Processing</span>
                </div>
                <span className="font-mono font-bold text-white">{statusCounts.processing} ({statusCounts.processingPct}%)</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899]" />
                  <span className="text-gray-300">Pending</span>
                </div>
                <span className="font-mono font-bold text-white">{statusCounts.pending} ({statusCounts.pendingPct}%)</span>
              </div>

              {statusCounts.rejected > 0 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                    <span className="text-gray-300">Rejected</span>
                  </div>
                  <span className="font-mono font-bold text-white">{statusCounts.rejected} ({statusCounts.rejectedPct}%)</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.04] text-[11px] text-gray-400 flex items-center justify-between">
            <span>Status diperbarui otomatis oleh sistem distribusi</span>
            <button
              onClick={() => navigate('/dashboard/releases')}
              className="text-purple-400 hover:text-purple-300 font-semibold"
            >
              Kelola Rilis →
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          ROW 2: Release Activity (7 cols) + Top Releases (5 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* Release Activity Chart */}
        <div className="lg:col-span-7 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Aktivitas Rilis</h3>
              <p className="text-[11px] text-[#8E92A0]">Distribusi rilis per bulan</p>
            </div>
            <span className="text-[10px] text-[#8E92A0] font-mono">
              {releaseActivityData.length > 0 ? `${releaseActivityData.length} Bulan Aktif` : 'Data belum tersedia'}
            </span>
          </div>

          <div className="relative w-full h-[200px] flex items-center justify-center">
            {releaseActivityData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-6 bg-[#141419]/50 rounded-2xl border border-white/[0.03] w-full h-full">
                <Calendar className="w-8 h-8 text-gray-600 mb-1.5 opacity-40" />
                <p className="text-xs font-bold text-white">Data belum tersedia</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Grafik aktivitas rilis akan terisi saat Anda mendaftarkan karya baru.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={releaseActivityData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#787D8D', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#787D8D', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#121318] border border-purple-500/30 px-3 py-1.5 rounded-xl shadow-xl text-xs">
                            <p className="text-white font-mono font-bold">{payload[0].value} Rilisan</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="tracks" fill="#A855F7" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Releases by Real Streams */}
        <div className="lg:col-span-5 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white tracking-tight">Rilisan Terpopuler</h3>
            <span className="text-[11px] font-mono text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
              Streams
            </span>
          </div>

          {topReleasesByStreams.length === 0 ? (
            <div className="text-center py-10 my-auto bg-white/[0.01] rounded-2xl border border-white/[0.02]">
              <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold text-gray-300">Data belum tersedia</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Belum ada rekaman streams untuk rilisan pada katalog ini.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 my-auto">
              {topReleasesByStreams.map((rel, idx) => (
                <div key={rel.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-gray-500 w-4 font-bold">0{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{rel.title}</p>
                      <p className="text-[10px] text-gray-400">{rel.release_type.toUpperCase()}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    {rel.streams.toLocaleString()} plays
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-white/[0.04] text-[11px] text-gray-400 flex items-center justify-between">
            <span>Diurutkan berdasarkan total putar DSP</span>
            <button
              onClick={() => navigate('/dashboard/analytics')}
              className="text-purple-400 hover:text-purple-300 font-semibold"
            >
              Lihat Analitik →
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          ROW 3: All Releases Table (Search, Filters, Pagination)
         ========================================================================= */}
      <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] overflow-hidden shadow-xl">
        {/* Table Controls Header */}
        <div className="p-6 border-b border-white/[0.04] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Semua Rilisan</h3>
            <p className="text-xs text-[#8E92A0]">Daftar lengkap katalog musik yang terdaftar pada akun Anda.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative w-56 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari judul, artis, ISRC, UPC..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#131417] text-white text-xs pl-8 pr-3 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50 placeholder:text-gray-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: any) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#131417] text-white text-xs px-3 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="All">Semua Status</option>
              <option value="Published">Published</option>
              <option value="Processing">Processing</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="bg-[#131417] text-white text-xs px-3 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="streams">Streams Terbanyak</option>
              <option value="royalties">Royalti Tertinggi</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.04] text-[#8E92A0] uppercase tracking-wider text-[11px] bg-white/[0.01]">
                <th className="py-4 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === paginatedReleases.length && paginatedReleases.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-transparent text-purple-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4">Rilisan & Track</th>
                <th className="py-4 px-4">Artis</th>
                <th className="py-4 px-4">Tipe</th>
                <th className="py-4 px-4">ISRC</th>
                <th className="py-4 px-4">Tanggal Rilis</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-right">Streams</th>
                <th className="py-4 px-4 text-right">Royalti</th>
                <th className="py-4 px-4 text-center w-12">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.03]">
              {paginatedReleases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-gray-400">
                    <Music2 className="w-10 h-10 text-gray-600 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-white text-sm">Tidak Ada Rilisan Musik</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      {catalogList.length === 0
                        ? 'Anda belum memiliki rilisan musik di katalog. Klik tombol di bawah untuk membuat rilisan pertama Anda.'
                        : 'Tidak ada rilisan yang cocok dengan kriteria pencarian atau filter yang dipilih.'}
                    </p>
                    {catalogList.length === 0 && (
                      <div className="pt-3">
                        <button
                          onClick={() => navigate('/dashboard/releases')}
                          className="px-4 py-2 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/50 text-xs font-semibold transition-colors"
                        >
                          + Buat Rilis Baru
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedReleases.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-purple-500/[0.04]' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(row.id)}
                          className="rounded border-white/20 bg-transparent text-purple-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-900/20 border border-white/[0.06] flex items-center justify-center flex-shrink-0 text-purple-400 overflow-hidden shadow-sm">
                            {row.cover_url ? (
                              <img
                                src={row.cover_url}
                                alt={row.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Music className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate max-w-[200px]">{row.title}</p>
                            <p className="text-[10px] text-[#8E92A0] font-mono">{row.genre}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-300 whitespace-nowrap">
                        {row.artist}
                      </td>

                      <td className="py-3.5 px-4 text-[#8E92A0] uppercase font-mono text-[10px] whitespace-nowrap">
                        {row.release_type}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        {row.isrc || '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-gray-400 whitespace-nowrap">
                        {row.release_date}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.status === 'published' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Live
                          </span>
                        ) : row.status === 'processing' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Review
                          </span>
                        ) : row.status === 'rejected' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            Ditolak
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-white text-right whitespace-nowrap">
                        {row.streams > 0 ? row.streams.toLocaleString() : '0'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-white text-right whitespace-nowrap">
                        ${row.royalties_usd.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-center relative">
                        <button
                          onClick={() => setActionMenuOpenId(actionMenuOpenId === row.id ? null : row.id)}
                          className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer mx-auto"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {actionMenuOpenId === row.id && (
                          <div className="absolute right-6 top-10 w-44 bg-[#181920] border border-white/[0.08] rounded-2xl shadow-2xl p-1.5 z-30 text-left animate-fadeIn">
                            <button
                              onClick={() => {
                                setDetailModalItem(row);
                                setActionMenuOpenId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                              <span>Lihat Detail</span>
                            </button>
                            <button
                              onClick={() => {
                                setEditModalItem(row);
                                setEditTitle(row.title);
                                setEditGenre(row.genre);
                                setActionMenuOpenId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                              <span>Edit Metadata</span>
                            </button>
                            <button
                              onClick={() => {
                                playTrack(row);
                                setActionMenuOpenId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <Play className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Putar Lagu</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span className="text-[#8E92A0] font-mono">
            Menampilkan {filteredReleases.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredReleases.length)} dari {filteredReleases.length} rilisan
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              const isActive = currentPage === p;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          MODAL 1: Detail Modal
         ========================================================================= */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1c1d23] border border-white/[0.08] rounded-[28px] max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setDetailModalItem(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Detail Rilisan Musik</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">Judul Rilisan</span>
                <span className="font-bold text-white">{detailModalItem.title}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">Nama Artis</span>
                <span className="text-white">{detailModalItem.artist}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">Tipe Rilisan</span>
                <span className="uppercase font-mono text-purple-400">{detailModalItem.release_type}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">Genre</span>
                <span className="text-white">{detailModalItem.genre}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">ISRC</span>
                <span className="font-mono text-gray-300">{detailModalItem.isrc || 'Belum terbit'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">UPC</span>
                <span className="font-mono text-gray-300">{detailModalItem.upc || 'Belum terbit'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">Tanggal Rilis</span>
                <span className="font-mono text-white">{detailModalItem.release_date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-gray-400">Status Distribusi</span>
                <span className="font-bold uppercase text-emerald-400">{detailModalItem.status}</span>
              </div>
              {detailModalItem.rejection_reason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 mt-2">
                  <span className="font-bold block mb-1">Catatan Penolakan:</span>
                  {detailModalItem.rejection_reason}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: Edit Metadata Modal
         ========================================================================= */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1c1d23] border border-white/[0.08] rounded-[28px] max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditModalItem(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">Edit Metadata Rilisan</h3>
            <p className="text-xs text-gray-400 mb-4">Perbarui informasi lagu sebelum diverifikasi oleh distributor.</p>

            <form onSubmit={handleSaveMetadata} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Judul Lagu</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#131417] text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-purple-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Genre</label>
                <input
                  type="text"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className="w-full bg-[#131417] text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-purple-500/50"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
