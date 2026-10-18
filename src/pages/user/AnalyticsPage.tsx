import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, Play, Pause, TrendingUp, Music2, Radio, Users, Compass } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import type { StreamingRecordItem } from '@services/distributionSyncService';
import { getStreamingRecords as fetchApiStreaming, getArtistStreamingAggregates } from '@services/analyticsService';
import { getRoyaltyEntries } from '@services/royaltiesService';
import { useAuth } from '@contexts/AuthContext';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [records, setRecords] = useState<StreamingRecordItem[]>([]);
  const [artistStreamingReports, setArtistStreamingReports] = useState<any[]>([]);
  const [royaltyEntries, setRoyaltyEntries] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<'All' | 'Spotify' | 'YouTube' | 'Apple Music'>('All');

  // Player state for featured track
  const [isPlayingFeatured, setIsPlayingFeatured] = useState(false);
  const [playerProgress] = useState(0);

  // Load backend and synced streaming records
  const loadData = async () => {
    try {
      setLoading(true);

      let apiStreaming: any[] = [];
      let manualReportsList: any[] = [];
      if (user?.id) {
        const [streaming, royalties, artistReports] = await Promise.all([
          fetchApiStreaming(user.id),
          getRoyaltyEntries(user.id),
          getArtistStreamingAggregates(user.id),
        ]);
        apiStreaming = streaming.data || [];
        manualReportsList = artistReports.data || [];
        if (!royalties.error) setRoyaltyEntries(royalties.data || []);
        if (!artistReports.error) setArtistStreamingReports(manualReportsList);
      }

      const mappedApiStreaming: StreamingRecordItem[] = apiStreaming.map((s: any) => ({
        id: s.id,
        user_id: user?.id || '',
        artist_name: s.artist_name || '',
        track_title: s.track_title || '',
        platform: s.platform || '',
        period: s.reporting_period?.slice(0, 7) || '',
        streams: Number(s.streams || s.playCount || 0),
        royalty_usd: 0,
        status: undefined,
        created_at: s.created_at || '',
      }));

      const combinedReports: StreamingRecordItem[] = [...mappedApiStreaming];
      // Anti-duplication: group manual reports by period
      const byPeriod = new Map<string, any[]>();
      for (const m of manualReportsList) {
        const periodKey = m.period_start?.slice(0, 7) || 'all';
        if (!byPeriod.has(periodKey)) byPeriod.set(periodKey, []);
        byPeriod.get(periodKey)!.push(m);
      }
      for (const [periodKey, list] of byPeriod.entries()) {
        const hasAggregate = list.some((r) => r.platform.toLowerCase() === 'agregat' || r.platform.toLowerCase() === 'all');
        const itemsToUse = hasAggregate
          ? list.filter((r) => r.platform.toLowerCase() === 'agregat' || r.platform.toLowerCase() === 'all')
          : list;
        itemsToUse.forEach((m) => {
          combinedReports.push({
            id: m.id,
            user_id: user?.id || '',
            artist_name: m.artist_name || '',
            track_title: m.artist_name || 'Streaming Artis',
            platform: m.platform || 'Agregat',
            period: periodKey,
            streams: Number(m.streams || 0),
            royalty_usd: m.gross_revenue ? Number(m.gross_revenue) : 0,
            status: undefined,
            created_at: m.created_at || '',
          });
        });
      }
      setRecords(combinedReports);
    } catch (e) {
      console.error('Error loading analytics records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  // Filtered Records by selected platform
  const platformFilteredRecords = useMemo(() => {
    if (selectedPlatform === 'All') return records;
    const target = selectedPlatform.toLowerCase();
    return records.filter(r => (r.platform || '').toLowerCase().includes(target));
  }, [records, selectedPlatform]);

  // Total Streams Count (genuine sum, zero if none)
  const totalStreamsCount = useMemo(() => {
    return platformFilteredRecords.reduce((sum, r) => sum + (r.streams || 0), 0);
  }, [platformFilteredRecords]);

  // Earnings & Clearing breakdown from genuine data
  const earningsData = useMemo(() => {
    const totalUsd = royaltyEntries.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      total: totalUsd,
    };
  }, [royaltyEntries]);

  // Streaming Timeline Data (Genuine aggregation by period)
  const streamingTimeline = useMemo<Array<{ date: string; label: string; streams: number }>>(() => {
    if (platformFilteredRecords.length === 0) return [];

    const map: Record<string, { date: string; label: string; streams: number }> = {};
    platformFilteredRecords.forEach((r) => {
      const p = r.period;
      if (!p) return;
      if (!map[p]) {
        map[p] = {
          date: p,
          label: p.length > 7 ? p.slice(5) : p,
          streams: 0,
        };
      }
      map[p].streams += r.streams || 0;
    });

    return Object.values(map);
  }, [platformFilteredRecords]);

  // Dynamic Peak Point on Timeline
  const peakTimelinePoint = useMemo(() => {
    if (streamingTimeline.length === 0) return null;
    const maxIdx = streamingTimeline.reduce(
      (bestIdx, item, index, items) => item.streams > items[bestIdx].streams ? index : bestIdx,
      0,
    );
    const maxItem = streamingTimeline[maxIdx];
    if (!maxItem || maxItem.streams <= 0) return null;

    const leftPercent = ((maxIdx + 0.5) / streamingTimeline.length) * 100;
    return {
      item: maxItem,
      value: maxItem.streams,
      leftPercent: Math.min(88, Math.max(12, leftPercent)),
    };
  }, [streamingTimeline]);

  // Genuine Top Tracks ranking
  const topTracksList = useMemo(() => {
    const map: Record<string, { title: string; streams: number; cover: string }> = {};

    records.forEach(r => {
      const title = r.track_title;
      if (!title) return;
      if (!map[title]) {
        map[title] = {
          title,
          streams: 0,
          cover: '',
        };
      }
      map[title].streams += (r.streams || 0);
    });

    const list = Object.values(map).sort((a, b) => b.streams - a.streams);
    return list;
  }, [records]);

  // Featured track for playback
  const featuredTrack = useMemo(() => {
    if (topTracksList.length > 0) return topTracksList[0];
    return null;
  }, [topTracksList]);

  // Audio Playback Handler
  const toggleFeaturedPlay = () => {
    if (!featuredTrack) return;
    const nextState = !isPlayingFeatured;
    setIsPlayingFeatured(nextState);
    window.dispatchEvent(
      new CustomEvent('groovvy-play-track', {
        detail: {
          title: featuredTrack.title,
          artist: user?.fullName || '',
          album: featuredTrack.title,
          artwork: featuredTrack.cover || '',
        },
      })
    );
  };

  return (
    <div className="text-white font-sans w-full max-w-[1600px] mx-auto space-y-6">

      <section className="rounded-[28px] border border-white/[0.05] bg-[#1c1d23] p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Laporan streaming per artis</h2>
            <p className="mt-1 text-xs text-[#8E92A0]">Laporan agregat admin ditampilkan terpisah dari rincian per track dan tidak dijumlahkan ke grafik track.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#A7AAB5]">{artistStreamingReports.length} laporan</span>
        </div>
        {artistStreamingReports.length === 0 ? <p className="rounded-xl border border-white/[0.05] bg-black/10 p-4 text-sm text-[#8E92A0]">Belum ada laporan streaming agregat untuk akun ini.</p> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-[#777C89]"><th className="py-3 pr-4">Artis</th><th className="py-3 pr-4">Platform / wilayah</th><th className="py-3 pr-4">Periode</th><th className="py-3 pr-4">Streaming</th><th className="py-3">Pendapatan sumber</th></tr></thead>
              <tbody>{artistStreamingReports.map((report: any) => <tr key={report.id} className="border-b border-white/[0.04] last:border-0"><td className="py-3 pr-4 font-medium text-white">{report.artist_name}</td><td className="py-3 pr-4 text-[#A7AAB5]">{report.platform}{report.territory ? ` · ${report.territory}` : ''}</td><td className="py-3 pr-4 text-[#A7AAB5]">{report.period_start} — {report.period_end}</td><td className="py-3 pr-4 font-mono text-white">{Number(report.streams || 0).toLocaleString()}</td><td className="py-3 text-[#A7AAB5]">{report.gross_revenue == null ? 'Tidak dilaporkan' : `${report.currency} ${Number(report.gross_revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td></tr>)}</tbody>
            </table>
          </div>}
      </section>

      {/* =========================================================================
          MAIN ASYMMETRIC GRID
          Left: 8 Cols (Streams + Earnings / Target Audience + Releases)
          Right: 4 Cols (Listeners / Countries + Featured Track Player)
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* =======================================================================
            LEFT COLUMN (xl:col-span-8)
           ======================================================================= */}
        <div className="xl:col-span-8 flex flex-col gap-5 sm:gap-6">

          {/* TOP ROW: Streams Performance (7 cols) + Earnings (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            {/* 1. TOP-LEFT CARD: STREAMS TOTAL & PERFORMANCE LINE CHART */}
            <div className="lg:col-span-7 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between relative overflow-hidden group">

              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div>
                  <span className="text-xs font-semibold text-[#8E92A0] uppercase tracking-wider">
                    Total Streams
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-0.5 font-mono">
                    {totalStreamsCount > 0 ? totalStreamsCount.toLocaleString() : (records.length === 0 ? 'Data belum tersedia' : '0')}
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
                    <span className="text-xs font-bold text-[#1DB954]">S</span>
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
                    <span className="text-xs font-bold text-[#FF0000]">Y</span>
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
                    <span className="text-xs font-bold text-[#FA243C]">A</span>
                  </button>
                </div>
              </div>

              {/* Streaming Performance Area Chart */}
              <div className="relative w-full h-[190px] sm:h-[210px] mt-2 flex items-center justify-center">
                {streamingTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 bg-[#141419]/50 rounded-2xl border border-white/[0.03] w-full h-full">
                    <TrendingUp className="w-8 h-8 text-gray-600 mb-1.5 opacity-50" />
                    <p className="text-xs font-bold text-white">Data belum tersedia</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Laporan streaming bulanan belum diimpor ke sistem.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Dynamic Peak Callout Badge */}
                    {peakTimelinePoint && (
                      <div
                        className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full"
                        style={{ left: `${peakTimelinePoint.leftPercent}%`, top: '30%' }}
                      >
                        <div className="bg-[#121318]/95 border border-purple-500/40 rounded-xl px-2.5 py-1 shadow-2xl backdrop-blur-md text-center">
                          <p className="text-[10px] text-gray-400 font-medium">{peakTimelinePoint.item.label}</p>
                          <p className="text-xs font-bold text-white tracking-wide font-mono">
                            {peakTimelinePoint.value.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-white border-2 border-[#A855F7] ring-4 ring-purple-500/30 mx-auto mt-1" />
                        <div className="w-[1px] h-12 border-l border-dashed border-purple-500/40 mx-auto" />
                      </div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={streamingTimeline} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="purpleStreamingWave" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#A855F7" stopOpacity={0.35} />
                            <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.12} />
                            <stop offset="100%" stopColor="#6366F1" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>

                        <YAxis hide domain={['dataMin - 100', 'dataMax + 200']} />
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
                          fill="url(#purpleStreamingWave)"
                          dot={false}
                          activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#A855F7', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>

            </div>

            {/* 2. TOP-MIDDLE CARD: EARNINGS & ROYALTY CLEARING BREAKDOWN */}
            <div className="lg:col-span-5 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-bold text-white tracking-tight">Earnings</span>
                  <button
                    onClick={() => navigate('/dashboard/royalties')}
                    className="text-xs font-semibold text-[#8E92A0] hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    Rincian Royalti
                  </button>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5 font-mono">
                  ${earningsData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="text-center py-6 text-xs text-gray-500">
                <p className="font-semibold text-gray-400">Data belum tersedia</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Laporan royalti dari DSP belum tercatat pada akun ini.
                </p>
              </div>

            </div>

          </div>

          {/* BOTTOM ROW: Target Audience (4 cols) + Top Releases (8 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            {/* 3. BOTTOM-LEFT CARD: TARGET AUDIENCE (GENUINE STATUS) */}
            <div className="lg:col-span-4 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white tracking-tight">Demografi Audiens</h3>
                <Users className="w-4 h-4 text-gray-500" />
              </div>

              <div className="flex flex-col items-center justify-center text-center p-6 h-[180px] bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                <Compass className="w-8 h-8 text-gray-600 mb-2 opacity-50" />
                <p className="text-xs font-bold text-gray-300">Data belum tersedia</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[200px]">
                  Statistik demografi usia memerlukan integrasi analitik langsung dari platform DSP.
                </p>
              </div>
            </div>

            {/* 4. BOTTOM-MIDDLE CARD: TOP RELEASES LIST */}
            <div className="lg:col-span-8 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl flex flex-col justify-between">

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white tracking-tight">Lagu Teratas</h3>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/dashboard/catalog')}
                    className="text-xs font-semibold text-[#8E92A0] hover:text-white transition-colors cursor-pointer"
                  >
                    Semua Katalog
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/releases')}
                    className="bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-[0_4px_14px_rgba(168,85,247,0.35)] transition-all cursor-pointer"
                  >
                    + Rilis Baru
                  </button>
                </div>
              </div>

              {topTracksList.length === 0 ? (
                <div className="text-center py-10 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                  <Music2 className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold text-gray-300">Belum Ada Lagu Terdaftar</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Rilis lagu pertama Anda untuk mulai memantau analitik streaming.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  {topTracksList.slice(0, 8).map((track, idx) => (
                    <div
                      key={track.title}
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('groovvy-play-track', {
                            detail: {
                              title: track.title,
                              artist: user?.fullName || 'Artis',
                              album: 'Rilisan',
                              artwork: track.cover || '',
                            },
                          })
                        );
                      }}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-[#787D8D] font-medium w-4">
                          {String(idx + 1).padStart(2, '0')}
                        </span>

                        <div className="w-9 h-9 rounded-xl bg-purple-900/20 border border-white/[0.06] flex items-center justify-center flex-shrink-0 text-purple-400">
                          <Music2 className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#8E92A0] font-mono">
                            {track.streams > 0 ? `${track.streams.toLocaleString()} plays` : '0 plays'}
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#787D8D] group-hover:text-white transition-colors" />
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>

        </div>

        {/* =======================================================================
            RIGHT COLUMN (xl:col-span-4) - LISTENERS, COUNTRIES, FEATURED TRACK
           ======================================================================= */}
        <div className="xl:col-span-4 bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between gap-6">

          {/* TOP SECTION: LISTENERS NOW & COUNTRIES */}
          <div>
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs font-semibold text-[#8E92A0]">Pendengar Aktif</span>
                <div className="text-xl sm:text-2xl font-bold text-gray-400 tracking-tight mt-1">
                  Data belum tersedia
                </div>
              </div>
              <span className="text-[10px] text-gray-500 font-mono px-2 py-0.5 rounded-full bg-white/[0.04]">
                Realtime DSP
              </span>
            </div>

            {/* Country Breakdown */}
            <div className="space-y-3 pt-2 border-t border-white/[0.04]">
              <span className="text-xs font-semibold text-[#8E92A0] block">Negara Teratas</span>
              <div className="text-center py-6 text-xs text-gray-500">
                <Globe className="w-6 h-6 text-gray-600 mx-auto mb-1.5 opacity-50" />
                <p className="font-semibold text-gray-400">Data belum tersedia</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Distribusi wilayah akan terisi saat laporan streaming menyertakan data negara.
                </p>
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: FEATURED TRACK ARTWORK & PLAYER */}
          <div className="relative w-full rounded-[24px] overflow-hidden aspect-[4/5] max-h-[360px] shadow-2xl border border-white/[0.08] bg-[#14151b] flex flex-col justify-between p-5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-semibold">Pemutar Lagu</span>
              <Radio className="w-4 h-4 text-purple-400" />
            </div>

            <div className="flex flex-col items-center justify-center my-auto text-center">
              <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-xl mb-3">
                <Music2 className="w-10 h-10" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-wide truncate max-w-[200px]">
                {featuredTrack ? featuredTrack.title : 'Belum Ada Lagu'}
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                {user?.fullName || 'Artis Breakout'}
              </p>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${playerProgress}%` }} />
              </div>

              <div className="flex items-center justify-center gap-6 text-white/90">
                <button
                  onClick={toggleFeaturedPlay}
                  disabled={!featuredTrack}
                  className="w-10 h-10 rounded-full bg-white text-black hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  title={isPlayingFeatured ? 'Pause' : 'Play'}
                >
                  {isPlayingFeatured ? (
                    <Pause className="w-4 h-4 fill-current text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
