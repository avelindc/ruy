import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Download, Radio, Menu, MoreHorizontal, Wallet, TrendingUp, Layers } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell
} from 'recharts';
import type { ReleaseSubmission, StreamingRecordItem } from '@services/distributionSyncService';
import { getUserReleases } from '@services/releaseService';
import { getRoyaltyEntries } from '@services/royaltiesService';
import { getStreamingRecords as fetchApiStreaming } from '@services/analyticsService';
import { getWithdrawalRequests, type WithdrawalRecord } from '@services/withdrawalService';
import { useAuth } from '@contexts/AuthContext';

// Platform accent colors
const PLATFORM_COLORS: Record<string, string> = {
  Spotify: '#1DB954',
  'Apple Music': '#FA243C',
  'YouTube Music': '#FF0000',
  'YouTube': '#FF0000',
  'TikTok': '#A855F7',
  'Amazon Music': '#FF9900',
  'Deezer': '#00C7F2',
  'Lainnya': '#787D8D',
};

export default function MusicHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [timeFilter, setTimeFilter] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Week');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [submissions, setSubmissions] = useState<ReleaseSubmission[]>([]);
  const [streamingRecords, setStreamingRecords] = useState<StreamingRecordItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [, setLoading] = useState(true);

  // Load Real Data from Neon Backend + Synced Service
  const loadData = async () => {
    try {
      setLoading(true);

      if (!user) return;
      let apiReleases: any[] = [];
      let apiRoyalties: any[] = [];
      let apiStreaming: any[] = [];
      const [releasesRes, royaltiesRes, streamingRes, withdrawalsRes] = await Promise.all([
        getUserReleases(user.id), getRoyaltyEntries(user.id), fetchApiStreaming(user.id), getWithdrawalRequests(user.id),
      ]);
      apiReleases = releasesRes.data || [];
      apiRoyalties = royaltiesRes.data || [];
      apiStreaming = streamingRes.data || [];
      if (!withdrawalsRes.error) setWithdrawals(withdrawalsRes.data);

      setRoyalties(apiRoyalties);

      // Map API releases (strictly belonging to this user)
      const mappedApiReleases: ReleaseSubmission[] = apiReleases
        .filter((r: any) => !r.owner_id || r.owner_id === user?.id)
        .map((r: any) => ({
          id: r.id,
          title: r.title || '',
          release_type: (r.release_type || 'single').toLowerCase() as any,
          artist_name: r.artist?.artist_name || r.primary_artist?.artist_name || '',
          genre: r.genre || '',
          release_date: r.release_date || '',
          cover_url: r.artwork_url || '',
          tiktok_clip_start: r.tracks?.[0]?.tiktok_clip_start || '',
          tiktok_clip_duration: '',
          isrc: r.tracks?.[0]?.isrc || '',
          upc: r.upc,
          status: r.status,
          user_id: user.id,
          user_name: user.fullName || user.email || '',
          user_email: user.email || '',
          created_at: r.created_at || '',
          updated_at: r.updated_at || '',
        }));
      setSubmissions(mappedApiReleases);

      // Map API streaming records
      const mappedApiStreaming: StreamingRecordItem[] = apiStreaming.map((s: any) => ({
        id: s.id,
        user_id: user?.id || '',
        artist_name: s.artist_name || '',
        track_title: s.track_title || '',
        platform: s.platform || '',
        period: s.reporting_period?.slice(0, 7) || '',
        streams: Number(s.streams || 0),
        royalty_usd: s.currency === 'USD' ? Number(s.revenue || 0) : 0,
        currency: s.currency,
        created_at: s.created_at || '',
      }));
      setStreamingRecords(mappedApiStreaming);

    } catch (e) {
      console.error('Error loading real overview data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  // Real Financial Totals
  const financials = useMemo(() => {
    const royaltyFromApi = royalties.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalRoyaltyUsd = royaltyFromApi;
    const withdrawnUsd = withdrawals.filter(w => w.status === 'paid').reduce((sum, w) => sum + w.amount, 0);
    const reservedUsd = withdrawals.filter(w => ['pending', 'under_review', 'approved', 'processing', 'paid'].includes(w.status)).reduce((sum, w) => sum + w.amount, 0);
    const availableUsd = Math.max(0, totalRoyaltyUsd - reservedUsd);
    const disbursedPct = totalRoyaltyUsd > 0 ? Math.min(100, Math.round((withdrawnUsd / totalRoyaltyUsd) * 100)) : 0;

    return { totalRoyaltyUsd, withdrawnUsd, availableUsd, disbursedPct };
  }, [royalties, withdrawals]);

  // Showcase real release for the stylized card
  const showcaseRelease = useMemo(() => {
    if (submissions.length > 0) return submissions[0];
    return null;
  }, [submissions]);

  // Real Activity Line Chart Data
  const activityData = useMemo(() => {
    if (streamingRecords.length === 0) return [];

    // Group streaming records by period
    const map: Record<string, number> = {};
    streamingRecords.forEach(s => {
      const p = s.period;
      if (!p) return;
      map[p] = (map[p] || 0) + (s.streams || 0);
    });

    const entries = Object.entries(map);
    if (entries.length === 0) return [];

    return entries.map(([label, val]) => ({
      label: label.length > 7 ? label.slice(5) : label,
      value: val,
    }));
  }, [streamingRecords]);

  // Real Payments Bar Chart Data (from genuine withdrawals)
  const paymentsData = useMemo(() => {
    if (withdrawals.length === 0) return [];

    const map: Record<string, number> = {};
    withdrawals.forEach(w => {
      const dateKey = w.created_at ? w.created_at.slice(0, 10) : '';
      if (dateKey) map[dateKey] = (map[dateKey] || 0) + w.amount;
    });

    const entries = Object.entries(map);
    return entries.map(([label, val], idx) => ({
      label,
      value: Math.round(val),
      active: idx === entries.length - 1,
    }));
  }, [withdrawals]);

  // Real Platform Distribution for the right panel
  const platformBreakdown = useMemo(() => {
    if (streamingRecords.length === 0) return [];

    const map: Record<string, number> = {};
    streamingRecords.forEach(s => {
      const p = s.platform;
      if (p) map[p] = (map[p] || 0) + (s.royalty_usd || 0);
    });

    const entries = Object.entries(map);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);

    return entries.map(([name, val]) => ({
      name,
      amount: val,
      percentage: total > 0 ? Math.round((val / total) * 100) : 0,
      color: PLATFORM_COLORS[name] || '#A855F7',
    })).sort((a, b) => b.amount - a.amount);
  }, [streamingRecords]);

  // Display user name and initials
  const userName = user?.fullName || (user?.email ? user.email.split('@')[0] : '—');
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <div className="w-full space-y-6 min-w-0 font-sans text-white select-none">

      {/* =========================================================================
          1. HEADER HORIZONTAL
          [Title: Overview]  [Time filter pills]   [Search] [Bell] [User Profile]
         ========================================================================= */}
      <header className="flex flex-wrap items-center justify-between gap-4 py-1">

        {/* LEFT: Mobile Menu Toggle + Title + Period Filter Pills */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-menu'))}
            className="lg:hidden p-2 rounded-xl bg-[#1e1f25] border border-white/[0.05] text-gray-300 hover:text-white"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Overview
          </h1>

          {/* Time Filter Capsule */}
          <div className="inline-flex items-center p-1 rounded-full bg-[#1b1c22] border border-white/[0.04] shadow-inner">
            {(['Day', 'Week', 'Month', 'Year'] as const).map((period) => {
              const active = timeFilter === period;
              return (
                <button
                  key={period}
                  onClick={() => setTimeFilter(period)}
                  className={`px-3.5 sm:px-5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-[#FF6A3D] text-white shadow-[0_4px_16px_rgba(255,106,61,0.35)]'
                      : 'text-[#8E92A0] hover:text-white'
                  }`}
                >
                  {period}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Search, Notifications, Profile */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          {/* Search Trigger */}
          <div className="relative">
            {searchOpen ? (
              <div className="flex items-center bg-[#1b1c22] border border-white/[0.08] rounded-full px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Cari lagu / katalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => !searchQuery && setSearchOpen(false)}
                  autoFocus
                  className="bg-transparent text-xs text-white focus:outline-none w-32 sm:w-48 placeholder:text-gray-500"
                />
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="w-9 h-9 rounded-full bg-[#1b1c22] border border-white/[0.04] flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Notification Bell */}
          <button
            onClick={() => navigate('/dashboard/notifications')}
            className="relative w-9 h-9 rounded-full bg-[#1b1c22] border border-white/[0.04] flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User Profile Pill */}
          <div
            onClick={() => navigate('/dashboard/settings')}
            className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-[#1b1c22] border border-white/[0.04] hover:border-white/[0.1] transition-all cursor-pointer group"
          >
            <span className="text-xs sm:text-sm font-semibold text-white tracking-tight group-hover:text-orange-200 transition-colors">
              {userName}
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#A855F7] to-[#FF6A3D] flex items-center justify-center text-white text-[11px] font-bold overflow-hidden border border-white/10 shadow-sm">
              <span>{userInitials}</span>
            </div>
          </div>
        </div>

      </header>

      {/* =========================================================================
          2. ASYMMETRIC GRID
          Left: 8 Cols (Wide Top Card + 2 Bottom Cards)
          Right: 4 Cols (Tall Panel with Balance & Platform Breakdown)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* LEFT COLUMN (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6 justify-between">

          {/* ---------------------------------------------------------------------
              TOP WIDE CARD ("My cards" / User Release Showcase + Real Transactions)
             --------------------------------------------------------------------- */}
          <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-4 sm:p-7 shadow-xl overflow-hidden max-w-full">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                My cards
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8E92A0]">Recent transaction</span>
                <button
                  onClick={() => navigate('/dashboard/withdrawals')}
                  className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                  title="Lihat semua transaksi"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Split Content: Left Music Card Stack | Right Transaction Activity */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">

              {/* LEFT HALF: Overlapping Stylized Release Cards (Visually Consistent with Admin) */}
              <div className="md:col-span-6 flex items-center justify-center py-2 overflow-hidden max-w-full pr-2">
                <div
                  onClick={() => navigate('/dashboard/withdrawals')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('/dashboard/withdrawals');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title="Buka Dompet & Penarikan Saldo"
                  className="relative w-full max-w-[280px] sm:max-w-[290px] h-[175px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#FF6A3D]/50 rounded-[24px]"
                >

                  {/* Back Card (Orange Glow Accent Card) */}
                  <div className="absolute right-0 top-3 w-[88%] h-[155px] rounded-[22px] bg-gradient-to-tr from-[#FF6A3D] to-[#FF8C61] shadow-[0_12px_28px_rgba(255,106,61,0.3)] opacity-95 transform translate-x-2 sm:translate-x-3 translate-y-1 overflow-hidden p-4 flex flex-col justify-between transition-transform duration-300 group-hover:translate-x-2.5 sm:group-hover:translate-x-3.5 group-hover:translate-y-1.5">
                    <div className="flex justify-between items-center text-white/90">
                      <span className="text-[11px] font-bold tracking-wider">Breakout Pass</span>
                      <Radio className="w-4 h-4 text-white/80" />
                    </div>
                    <div className="flex items-center justify-between text-white font-extrabold tracking-wider">
                      <span className="text-sm">DSP LIVE</span>
                      <span className="text-xs opacity-75">DSP NETWORK</span>
                    </div>
                  </div>

                  {/* Front Card (Frosted Glassmorphic Music Card) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/dashboard/withdrawals');
                    }}
                    className="absolute left-0 top-0 w-[90%] h-[165px] rounded-[22px] bg-gradient-to-br from-[#2f313e]/90 via-[#22232c]/95 to-[#16171f]/95 border border-white/[0.12] shadow-2xl p-4 sm:p-5 flex flex-col justify-between backdrop-blur-md cursor-pointer group-hover:scale-[1.02] transition-transform duration-300"
                  >
                    {/* Top Row: Release / Card Title + Gold Audio Chip */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] font-bold text-gray-200 tracking-wide block truncate max-w-[150px]">
                          {showcaseRelease ? showcaseRelease.title : 'Breakout Pass'}
                        </span>
                        <span className="text-[9px] text-[#A855F7] font-semibold tracking-wider uppercase">
                          {showcaseRelease ? (showcaseRelease.release_type || 'Single') : 'Belum Ada Rilis'}
                        </span>
                      </div>

                      {/* EMV / Audio Chip Icon */}
                      <div className="w-8 h-6 rounded-md bg-gradient-to-br from-[#E2B357] to-[#BA882F] p-0.5 shadow-sm flex items-center justify-center flex-shrink-0">
                        <div className="w-full h-full border border-amber-900/30 rounded-[3px] flex items-center justify-around px-0.5">
                          <span className="w-0.5 h-3 bg-amber-900/40" />
                          <span className="w-0.5 h-3 bg-amber-900/40" />
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Monospace Dots / ISRC Code (like **** 8702) */}
                    <div className="space-y-0.5">
                      <p className="text-xs font-mono font-bold tracking-widest text-gray-300 truncate">
                        {showcaseRelease?.isrc ? `•••• ${showcaseRelease.isrc.slice(-4)}` : '•••• ————'}
                      </p>
                      <p className="text-[9px] text-[#8E92A0] font-mono tracking-tight truncate">
                        {showcaseRelease ? `ISRC: ${showcaseRelease.isrc || 'Belum diterbitkan'}` : '+ Kelola saldo & penarikan'}
                      </p>
                    </div>

                    {/* Release date and brand */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-gray-400">
                        {showcaseRelease?.release_date || '—'}
                      </span>
                      <span className="text-lg font-black tracking-tighter text-white font-sans italic">
                        BREAKOUT
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT HALF: Real Transactions List (Withdrawals) */}
              <div className="md:col-span-6 space-y-3">
                {withdrawals.length === 0 ? (
                  <div className="text-center py-6 px-4 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                    <Wallet className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-gray-400">Belum ada transaksi</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Riwayat penarikan royalti Anda akan muncul di sini.
                    </p>
                  </div>
                ) : (
                  withdrawals.slice(0, 4).map((tx) => {
                    const isPaid = tx.status === 'paid';
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
                          }`}>
                            <Download className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white tracking-tight truncate">
                              {tx.channel || 'Penarikan'}
                            </p>
                            <p className="text-[10px] text-[#8E92A0] truncate">
                              {tx.account_number ? `****${tx.account_number.slice(-4)}` : (tx.method_type || 'Bank')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 pl-2">
                          <p className="text-xs font-bold font-mono text-white">
                            {tx.currency === 'USD' ? `$${Number(tx.amount || 0).toFixed(2)}` : `${Number(tx.amount || 0).toFixed(2)} ${tx.currency}`}
                          </p>
                          <p className={`text-[10px] font-semibold ${isPaid ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {isPaid ? 'Selesai' : 'Diproses'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

          {/* ---------------------------------------------------------------------
              BOTTOM ROW: Activity Wave + Payments Bar Chart
             --------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">

            {/* CARD 2: Activity */}
            <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[230px]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white tracking-tight">Aktivitas Streaming</h3>
                <span className="text-[10px] text-[#8E92A0] font-mono">
                  {activityData.length > 0 ? `${activityData.length} Periode` : 'Data belum tersedia'}
                </span>
              </div>

              {activityData.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-6 h-full">
                  <TrendingUp className="w-8 h-8 text-gray-600 mb-1.5 opacity-40" />
                  <p className="text-xs font-semibold text-gray-400">Data belum tersedia</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Grafik aktivitas akan muncul setelah data streaming terverifikasi.
                  </p>
                </div>
              ) : (
                <div className="w-full h-[155px] -mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#A855F7" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#A855F7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#787D8D', fontSize: 11, fontWeight: 500 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#121318] border border-purple-500/30 px-2.5 py-1 rounded-xl shadow-xl text-center text-xs">
                                <p className="text-white font-mono font-bold">
                                  {Number(payload[0].value).toLocaleString()} plays
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="natural"
                        dataKey="value"
                        stroke="#A855F7"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#A855F7', strokeWidth: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* CARD 3: Payments */}
            <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[230px]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white tracking-tight">Riwayat Pembayaran</h3>
                <span className="text-[10px] text-[#8E92A0] font-mono">
                  {paymentsData.length > 0 ? `${paymentsData.length} Transaksi` : 'Data belum tersedia'}
                </span>
              </div>

              {paymentsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-6 h-full">
                  <Wallet className="w-8 h-8 text-gray-600 mb-1.5 opacity-40" />
                  <p className="text-xs font-semibold text-gray-400">Data belum tersedia</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Grafik pembayaran akan tampil saat transaksi pencairan dicatat.
                  </p>
                </div>
              ) : (
                <div className="w-full h-[155px] -mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentsData} margin={{ top: 20, right: 5, left: 5, bottom: 0 }}>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#787D8D', fontSize: 11, fontWeight: 500 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#121318] border border-orange-500/30 px-2.5 py-1 rounded-xl shadow-xl text-center text-xs">
                                <p className="text-white font-mono font-bold">
                                  ${Number(payload[0].value).toFixed(2)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={22}>
                        {paymentsData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.active ? '#FF6A3D' : '#3d281f'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN (lg:col-span-4): TALL VERTICAL PANEL */}
        <div className="lg:col-span-4">
          <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between h-full space-y-6">

            {/* TOP: Circular Progress Ring (Pencairan Royalti) */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    className="stroke-[#272832]"
                    strokeWidth="9"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    className="stroke-[#A855F7]"
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - (financials.disbursedPct / 100))}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Inner Text: Real Metrics */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {financials.disbursedPct}%
                  </span>
                  <span className="text-xs font-bold text-[#8E92A0] mt-0.5 font-mono">
                    ${financials.withdrawnUsd.toFixed(0)} / ${financials.totalRoyaltyUsd.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium tracking-wide">
                    Tercairkan
                  </span>
                </div>
              </div>
            </div>

            {/* MIDDLE: Large Available Balance Display */}
            <div className="text-center space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
                ${financials.availableUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[#8E92A0] font-medium">
                Saldo Tersedia dalam USD
              </p>
            </div>

            {/* SEGMENTED HORIZONTAL BAR */}
            <div className="w-full px-2">
              <div className="w-full h-2.5 rounded-full flex overflow-hidden bg-[#2a2b36]">
                <div
                  className="h-full bg-[#FF6A3D] rounded-l-full transition-all"
                  style={{ width: `${Math.min(100, financials.disbursedPct)}%` }}
                />
                <div
                  className="h-full bg-[#A855F7] transition-all"
                  style={{ width: `${Math.max(0, 100 - financials.disbursedPct)}%` }}
                />
              </div>
            </div>

            {/* BOTTOM: Real Platform Streaming Breakdown */}
            <div className="space-y-3.5 pt-1">
              {platformBreakdown.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500">
                  <Layers className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                  <p className="font-semibold text-gray-400">Data belum tersedia</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Distribusi pendapatan per platform akan tercatat setelah laporan DSP masuk.
                  </p>
                </div>
              ) : (
                platformBreakdown.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-300 font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-gray-200">${item.amount.toFixed(2)}</span>
                      <span className="text-[#8E92A0] text-[11px] w-8 text-right">{item.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
