import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Globe, ChevronLeft, ChevronRight, MoreHorizontal, Play, Pause, SkipBack, SkipForward, FileSpreadsheet } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import type { StreamingRecordItem } from '@services/distributionSyncService';
import { apiGet } from '@lib/api/client';

export default function StreamingReportsPage() {
  const navigate = useNavigate();

  // State
  const [records, setRecords] = useState<StreamingRecordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'All' | 'Spotify' | 'YouTube' | 'Apple Music'>('All');

  // Player state
  const [catalogReleases, setCatalogReleases] = useState<any[]>([]);
  const [isPlayingFeatured, setIsPlayingFeatured] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);

  const loadData = async () => {
    try {
      setLoadError('');
      const [streamingRes, manualRes, releasesRes] = await Promise.allSettled([
        apiGet<any>('/api/streaming?limit=500'),
        apiGet<any>('/api/admin/artist-finance/streaming?limit=500'),
        apiGet<any>('/api/releases?limit=100'),
      ]);

      const apiList: StreamingRecordItem[] = streamingRes.status === 'fulfilled'
        ? (streamingRes.value.data?.data || []).map((r: any) => ({
            id: r.id,
            user_id: r.owner_id,
            artist_name: r.artist_name || '',
            track_title: r.track_title || '',
            platform: r.platform || '',
            period: r.reporting_period || '',
            streams: Number(r.streams || 0),
            royalty_usd: r.currency === 'USD' ? Number(r.revenue || 0) : 0,
            currency: r.currency,
            created_at: r.created_at,
            is_manual: false,
          }))
        : [];

      const manualList: StreamingRecordItem[] = manualRes.status === 'fulfilled'
        ? (manualRes.value.data?.data || []).map((m: any) => ({
            id: m.id,
            user_id: m.owner_id,
            artist_name: m.artist_name || '',
            track_title: m.artist_name || '',
            platform: m.platform || 'Agregat',
            period: m.period_start || '',
            streams: Number(m.streams || 0),
            royalty_usd: m.gross_revenue ? Number(m.gross_revenue) : 0,
            currency: m.currency || 'USD',
            created_at: m.created_at,
            is_manual: true,
          }))
        : [];

      const releases = releasesRes.status === 'fulfilled'
        ? (releasesRes.value.data?.data || releasesRes.value.data || [])
        : [];

      setCatalogReleases(Array.isArray(releases) ? releases : []);
      setRecords([...apiList, ...manualList]);
    } catch (error) {
      setRecords([]);
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat laporan streaming.');
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Top Releases combined from catalog releases and streaming play counts
  const realReleasesList = useMemo(() => {
    if (catalogReleases.length > 0) {
      return catalogReleases.map((release, index) => {
        const releaseArtist = (release.primary_artist || release.artist_name || release.artist || '').trim().toLowerCase();
        const releaseTitle = (release.title || '').trim().toLowerCase();

        // Attribute streams matching artist or track title
        const matchingStreams = records
          .filter(
            (r) =>
              (r.artist_name && r.artist_name.trim().toLowerCase() === releaseArtist) ||
              (r.track_title && r.track_title.trim().toLowerCase() === releaseTitle)
          )
          .reduce((sum, r) => sum + Number(r.streams || 0), 0);

        return {
          id: release.id,
          rank: String(index + 1).padStart(2, '0'),
          title: release.title || 'Untitled',
          artist: release.primary_artist || release.artist_name || 'Artis',
          plays: `${matchingStreams.toLocaleString()} streams`,
          rawPlays: matchingStreams,
          cover: release.cover_artwork_url || '',
          isPlaying: false,
        };
      }).sort((a, b) => b.rawPlays - a.rawPlays);
    }

    const list: Array<{
      id: string;
      rank: string;
      title: string;
      artist: string;
      plays: string;
      cover: string;
      isPlaying: boolean;
    }> = [];

    records.forEach((record, index) => {
      if (!record.track_title || list.some((item) => item.title === record.track_title && item.artist === record.artist_name)) return;
      const trackRows = records.filter((item) => item.track_title === record.track_title && item.artist_name === record.artist_name);
      list.push({ id: record.id, rank: String(index + 1).padStart(2, '0'), title: record.track_title, artist: record.artist_name, plays: `${trackRows.reduce((sum, item) => sum + item.streams, 0).toLocaleString()} streams`, cover: '', isPlaying: false });
    });

    return list;
  }, [catalogReleases, records]);

  const leftColumnReleases = realReleasesList.slice(0, 4);
  const rightColumnReleases = realReleasesList.slice(4, 8);
  const featuredTrack = realReleasesList.length > 0 ? realReleasesList[0] : null;

  // Toggle audio
  const toggleFeaturedPlay = () => {
    const nextState = !isPlayingFeatured;
    setIsPlayingFeatured(nextState);
    if (featuredTrack) {
      window.dispatchEvent(
        new CustomEvent('groovvy-play-track', {
          detail: {
            title: featuredTrack.title,
            artist: featuredTrack.artist,
            album: 'Single',
            artwork: featuredTrack.cover,
          },
        })
      );
    }
  };

  // Total streams filtered by platform (pure real data)
  const totalStreamsCount = useMemo(() => {
    return records.reduce((acc, r) => {
      if (selectedPlatform === 'All') return acc + (r.streams || 0);
      if (selectedPlatform === 'Spotify' && r.platform.toLowerCase().includes('spotify')) return acc + (r.streams || 0);
      if (selectedPlatform === 'YouTube' && r.platform.toLowerCase().includes('youtube')) return acc + (r.streams || 0);
      if (selectedPlatform === 'Apple Music' && r.platform.toLowerCase().includes('apple')) return acc + (r.streams || 0);
      return acc;
    }, 0);
  }, [records, selectedPlatform]);

  // Streaming records describe reported DSP revenue vs manual allocation.
  const earningsData = useMemo(() => {
    const dspRows = records.filter((r: any) => !r.is_manual);
    const manualRows = records.filter((r: any) => r.is_manual);

    const dspTotal = dspRows.reduce((acc, r) => acc + (r.royalty_usd || 0), 0);
    const manualTotal = manualRows.reduce((acc, r) => acc + (r.royalty_usd || 0), 0);
    const totalAll = dspTotal + manualTotal;

    const rows = [
      {
        label: 'DSP REPORTED',
        amount: Math.round(dspTotal),
        percentage: totalAll > 0 ? Math.round((dspTotal / totalAll) * 100) : 0,
        status: 'reported',
      },
      {
        label: 'ALOKASI MANUAL',
        amount: Math.round(manualTotal),
        percentage: totalAll > 0 ? Math.round((manualTotal / totalAll) * 100) : 0,
        status: 'cleared',
      },
    ];

    return {
      total: dspTotal,
      totalCombined: totalAll,
      rows,
    };
  }, [records]);

  // Streaming Timeline based on real record periods or timestamps
  const streamingTimeline = useMemo(() => {
    if (records.length > 0) {
      const dateMap: Record<string, number> = {};
      records.forEach(r => {
        const d = r.period || (r.created_at ? r.created_at.slice(5, 10) : 'DSP');
        dateMap[d] = (dateMap[d] || 0) + (r.streams || 0);
      });
      const entries = Object.entries(dateMap);
      if (entries.length > 1) {
        return entries.map(([date, st], idx) => ({
          date,
          label: date,
          streams: st,
          highlight: idx === entries.length - 1,
        }));
      } else if (entries.length === 1) {
        return [
          { date: 'Mulai', label: 'Mulai', streams: 0 },
          { date: entries[0][0], label: entries[0][0], streams: entries[0][1], highlight: true },
        ];
      }
    }

    return [];
  }, [records]);

  // Reports do not include listener demographic fields.
  // Platform Distribution for Right Panel
  const platformShares = useMemo(() => {
    if (records.length === 0) return [];
    const map: Record<string, number> = {};
    records.forEach(r => {
      map[r.platform] = (map[r.platform] || 0) + (r.streams || 0);
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map).map(([name, streams]) => ({
      name,
      streams,
      percentage: total > 0 ? Math.round((streams / total) * 100) : 0,
    })).sort((a, b) => b.streams - a.streams);
  }, [records]);

  const filteredRecords = records.filter(r =>
    r.track_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="text-white font-sans w-full max-w-[1600px] mx-auto space-y-6">

      {/* Toast notification */}
      {loadError && <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{loadError}</div>}

      {/* =========================================================================
          MAIN ASYMMETRIC GRID (MATCHING REFERENCE IMAGE IN BREAKOUT PURPLE-BLUE)
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* LEFT COLUMN (xl:col-span-8) */}
        <div className="xl:col-span-8 flex flex-col gap-5 sm:gap-6">

          {/* TOP ROW: Streams Performance (7 cols) + Earnings (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            {/* 1. TOP-LEFT: STREAMS & PERFORMANCE CHART */}
            <div className="lg:col-span-7 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div>
                  <span className="text-xs font-semibold text-[#8E92A0] uppercase tracking-wider">
                    Streams
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-0.5">
                    {totalStreamsCount.toLocaleString()}
                  </div>
                </div>

                {/* Platform selector pills */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSelectedPlatform('All')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      selectedPlatform === 'All'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-white/[0.03] text-[#8E92A0] hover:text-white border border-white/[0.03]'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>All</span>
                  </button>

                  <button
                    onClick={() => setSelectedPlatform('Spotify')}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      selectedPlatform === 'Spotify'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-white/[0.03] text-[#8E92A0] hover:text-white border border-white/[0.03]'
                    }`}
                    title="Spotify"
                  >
                    <svg className="w-3.5 h-3.5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.307c-.218.358-.684.474-1.042.256-2.859-1.747-6.458-2.142-10.697-1.173-.41.093-.82-.162-.913-.572-.093-.41.162-.82.572-.913 4.603-1.052 8.572-.607 11.824 1.36.358.218.474.684.256 1.042zm1.47-3.262c-.274.446-.86.589-1.306.315-3.273-2.012-8.261-2.595-12.132-1.419-.499.151-1.026-.135-1.178-.633-.151-.499.135-1.026.633-1.178 4.417-1.34 9.914-.687 13.668 1.609.446.274.589.86.315 1.306zm.126-3.411C15.183 8.32 8.72 8.1 4.978 9.236c-.604.184-1.246-.164-1.43-.768-.184-.604.164-1.246.768-1.43 4.296-1.305 11.433-1.05 15.89 1.597.544.323.723 1.027.4 1.571-.323.543-1.027.722-1.571.4z"/>
                    </svg>
                  </button>

                  <button
                    onClick={() => setSelectedPlatform('YouTube')}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      selectedPlatform === 'YouTube'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-white/[0.03] text-[#8E92A0] hover:text-white border border-white/[0.03]'
                    }`}
                    title="YouTube"
                  >
                    <svg className="w-3.5 h-3.5 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </button>

                  <button
                    onClick={() => setSelectedPlatform('Apple Music')}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      selectedPlatform === 'Apple Music'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-white/[0.03] text-[#8E92A0] hover:text-white border border-white/[0.03]'
                    }`}
                    title="Apple Music"
                  >
                    <svg className="w-3.5 h-3.5 text-[#FA243C]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 1.01-2.87-.96.04-2.09.64-2.74 1.4-.58.67-.99 1.74-.95 2.79 1.07.08 2.07-.57 2.68-1.32"/>
                    </svg>
                  </button>

                  <div className="flex items-center gap-1 ml-1 text-gray-500">
                    <button className="p-1 hover:text-white transition-colors cursor-pointer" title="Previous">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:text-white transition-colors cursor-pointer" title="Next">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Streaming Performance Line Chart */}
              <div className="relative w-full h-[190px] sm:h-[210px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={streamingTimeline}
                    margin={{ top: 15, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="adminPurpleStreamingWave" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A855F7" stopOpacity={0.35} />
                        <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <YAxis hide domain={['dataMin - 1500', 'dataMax + 2000']} />

                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#787D8D', fontSize: 11, fontWeight: 500 }}
                      dy={5}
                    />

                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#121318]/95 border border-purple-500/30 px-3 py-1.5 rounded-xl shadow-xl text-center">
                              <p className="text-[10px] text-gray-400">{data.date}</p>
                              <p className="text-xs font-bold text-purple-300 font-mono">
                                {Number(data.streams).toLocaleString()} plays
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="streams"
                      stroke="#A855F7"
                      strokeWidth={2.8}
                      fill="url(#adminPurpleStreamingWave)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#A855F7', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. TOP-MIDDLE: EARNINGS & CLEARING BREAKDOWN */}
            <div className="lg:col-span-5 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-bold text-white tracking-tight">DSP Reported Revenue</span>
                  <button
                    onClick={() => navigate('/admin/royalties')}
                    className="text-xs font-semibold text-[#8E92A0] hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    Show More
                  </button>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
                  ${earningsData.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="space-y-4">
                {earningsData.rows.map((row, idx) => {
                  const isCleared = row.status === 'cleared';
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`text-[10px] tracking-wider font-semibold ${isCleared ? 'text-purple-400' : 'text-[#8E92A0]'}`}>
                          {row.label}
                        </span>
                        <span className="font-mono font-bold text-white">
                          ${row.amount.toLocaleString('en-US')}
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCleared
                              ? 'bg-gradient-to-r from-[#A855F7] to-[#C084FC] shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                              : idx === 0
                              ? 'bg-gradient-to-r from-[#8B5CF6] to-[#A855F7]'
                              : idx === 1
                              ? 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]'
                              : 'bg-gradient-to-r from-[#4F67FF] to-[#6366F1]'
                          }`}
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* BOTTOM ROW: Target Audience (4 cols) + Top Releases (8 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            {/* 3. TARGET AUDIENCE */}
            <div className="lg:col-span-4 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl flex flex-col justify-between relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white tracking-tight">Target Audience</h3>
                <button
                  className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="More options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="h-[180px] flex items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.01] px-6 text-center text-xs text-gray-500">
                Laporan streaming yang tersedia tidak memuat data demografi pendengar.
              </div>
            </div>

            {/* 4. TOP RELEASES & + NEW RELEASE / INPUT BUTTON */}
            <div className="lg:col-span-8 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white tracking-tight">Top Releases</h3>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/admin/releases')}
                    className="text-xs font-semibold text-[#8E92A0] hover:text-white transition-colors cursor-pointer"
                  >
                    All Releases
                  </button>
                  <button
                    onClick={() => navigate('/admin/csv-import')}
                    className="bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-[0_4px_14px_rgba(168,85,247,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Import DSP Report</span>
                  </button>
                </div>
              </div>

              {/* 2-Column List or Clean Empty State */}
              {realReleasesList.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white/[0.01] rounded-2xl border border-white/[0.03] space-y-2">
                  <p className="text-xs font-semibold text-gray-400">Belum ada rilis lagu di katalog</p>
                  <p className="text-[11px] text-gray-500">Rilisan dengan baris laporan streaming akan tampil di sini.</p>
                  <button
                    onClick={() => navigate('/admin/catalog')}
                    className="mt-2 px-3.5 py-1.5 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Buka Manajemen Katalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                  <div className="space-y-2">
                    {leftColumnReleases.map((release) => (
                      <div
                        key={release.id}
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('groovvy-play-track', {
                              detail: {
                                title: release.title,
                                artist: release.artist,
                                album: 'Single',
                                artwork: release.cover,
                              },
                            })
                          );
                        }}
                        className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-[#787D8D] font-medium w-4">
                            {release.rank}
                          </span>
                          <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-white/[0.06] shadow-sm">
                            <img
                              src={release.cover}
                              alt={release.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/images/butterfly-effect.jpg';
                              }}
                            />
                            {release.isPlaying && (
                              <div className="absolute inset-0 bg-purple-950/60 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                              {release.title}
                            </p>
                            <p className="text-[11px] text-[#8E92A0] font-mono">
                              {release.plays}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#787D8D] group-hover:text-white transition-colors" />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {rightColumnReleases.map((release) => (
                      <div
                        key={release.id}
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('groovvy-play-track', {
                              detail: {
                                title: release.title,
                                artist: release.artist,
                                album: 'Single',
                                artwork: release.cover,
                              },
                            })
                          );
                        }}
                        className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-[#787D8D] font-medium w-4">
                            {release.rank}
                          </span>
                          <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-white/[0.06] shadow-sm">
                            <img
                              src={release.cover}
                              alt={release.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/images/butterfly-effect.jpg';
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                              {release.title}
                            </p>
                            <p className="text-[11px] text-[#8E92A0] font-mono">
                              {release.plays}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#787D8D] group-hover:text-white transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN (xl:col-span-4) - LISTENERS NOW, PLATFORM DISTRIBUTION, FEATURED TRACK */}
        <div className="xl:col-span-4 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between gap-6">

          <div>
            <div className="flex items-start justify-between mb-6">
            <div>
                <span className="text-xs font-semibold text-[#8E92A0]">Total Streams Terlapor</span>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-0.5">
                  {totalStreamsCount.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Platform Distribution */}
            <div className="space-y-3.5">
              {platformShares.length === 0 ? (
                <div className="text-center py-4 bg-white/[0.01] rounded-xl border border-white/[0.03]">
                  <p className="text-xs text-gray-400">Belum ada pembagian DSP aktif</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Input laporan DSP untuk melihat analitik.</p>
                </div>
              ) : (
                platformShares.slice(0, 5).map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="font-semibold text-gray-300">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white mr-2">{p.streams.toLocaleString()}</span>
                      <span className="font-mono text-purple-300 font-bold">{p.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Featured Track Player */}
          <div className="relative w-full rounded-[24px] overflow-hidden aspect-[4/5] max-h-[380px] shadow-2xl border border-white/[0.08] group">
            <img
              src={featuredTrack?.cover || '/images/hero-singer.jpg'}
              alt={featuredTrack ? `${featuredTrack.title} - ${featuredTrack.artist}` : 'Featured Track'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/images/butterfly-effect.jpg';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f14] via-[#0e0f14]/50 to-transparent" />

            <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col items-center text-center">
              <h4 className="text-sm font-bold text-white tracking-wide mb-1 truncate max-w-[200px]">
                {featuredTrack?.title || 'Belum Ada Lagu'}
              </h4>
              <p className="text-[11px] text-purple-300 font-semibold mb-3 truncate max-w-[200px]">
                {featuredTrack?.artist || 'Breakout Records'}
              </p>

              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const newPercent = Math.max(0, Math.min(100, Math.round((clickX / rect.width) * 100)));
                  setPlayerProgress(newPercent);
                }}
                className="w-full h-1 bg-white/20 rounded-full mb-4 relative cursor-pointer"
              >
                <div
                  className="h-full bg-white rounded-full relative"
                  style={{ width: `${playerProgress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-purple-500 shadow-md" />
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 text-white/90">
                <button
                  onClick={() => setPlayerProgress(prev => Math.max(0, prev - 15))}
                  className="p-1 hover:text-purple-300 transition-colors cursor-pointer"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={toggleFeaturedPlay}
                  className="w-10 h-10 rounded-full bg-white text-black hover:bg-purple-100 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  title={isPlayingFeatured ? 'Pause' : 'Play'}
                >
                  {isPlayingFeatured ? (
                    <Pause className="w-4 h-4 fill-current text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => setPlayerProgress(prev => Math.min(100, prev + 15))}
                  className="p-1 hover:text-purple-300 transition-colors cursor-pointer"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* =========================================================================
          ADMIN DATA MANAGEMENT CONTROLS (EXPANDABLE DSP LOG TABLE)
         ========================================================================= */}
      <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/[0.04] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Riwayat Sinkronisasi DSP &amp; Input Streaming
              </h3>
              <p className="text-xs text-[#8E92A0]">
                {records.length} data streaming tercatat di sistem Breakout Music
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-52 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari lagu, artis, DSP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#131417] text-white text-xs pl-9 pr-3.5 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <button
              onClick={() => navigate('/admin/csv-import')}
              className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Streaming</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.04] text-[#8E92A0] uppercase tracking-wider text-[11px] bg-white/[0.01]">
                <th className="py-3.5 px-6">Track &amp; Artis</th>
                <th className="py-3.5 px-4">DSP Platform</th>
                <th className="py-3.5 px-4">Periode</th>
                <th className="py-3.5 px-4">Streams (Plays)</th>
                <th className="py-3.5 px-6 text-right">DSP Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filteredRecords.slice(0, 10).map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-6">
                    <p className="font-bold text-white">{item.track_title}</p>
                    <p className="text-[11px] text-purple-400 mt-0.5">{item.artist_name}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-[10px]">
                      {item.platform}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-400">{item.period}</td>
                  <td className="py-3 px-4 font-mono font-bold text-white">{item.streams.toLocaleString()}</td>
                  <td className="py-3 px-6 text-right font-mono font-bold text-white">{item.currency === 'USD' ? `$${item.royalty_usd.toFixed(2)}` : `${item.royalty_usd.toFixed(2)} ${item.currency || ''}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
