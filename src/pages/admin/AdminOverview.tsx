import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Download, Radio, Menu, MoreHorizontal } from 'lucide-react';
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
import { getAdminStats } from '@services/adminService';
import { getAdminWithdrawalRequests, type WithdrawalRecord } from '@services/withdrawalService';
import { apiGet } from '@lib/api/client';
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

export default function AdminOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [timeFilter, setTimeFilter] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Week');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [streamingRecords, setStreamingRecords] = useState<any[]>([]);
  const [royaltyTotals, setRoyaltyTotals] = useState({
    totalStreams: 0,
    totalRoyaltyUsd: 0,
    withdrawnUsd: 0,
    availableUsd: 0,
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [statsRes, withdrawalsRes, streamingRes, manualStreamingRes] = await Promise.allSettled([
        getAdminStats(),
        getAdminWithdrawalRequests(),
        apiGet<any>('/api/streaming?limit=500'),
        apiGet<any>('/api/admin/artist-finance/streaming?limit=500'),
      ]);

      const apiWithdrawals: WithdrawalRecord[] = withdrawalsRes.status === 'fulfilled' ? withdrawalsRes.value.data : [];
      setWithdrawals(apiWithdrawals);
      const apiStreaming = streamingRes.status === 'fulfilled' ? (streamingRes.value.data?.data || []) : [];
      const manualStreaming = manualStreamingRes.status === 'fulfilled' ? (manualStreamingRes.value.data?.data || []) : [];
      const normalizedManual = manualStreaming.map((m: any) => ({
        id: m.id,
        platform: m.platform,
        reporting_period: m.period_start,
        streams: Number(m.streams || 0),
        revenue: m.gross_revenue ? Number(m.gross_revenue) : 0,
        currency: m.currency || 'USD',
        artist_name: m.artist_name,
        is_manual: true,
      }));
      setStreamingRecords([...apiStreaming, ...normalizedManual]);
      const statsData = statsRes.status === 'fulfilled' ? statsRes.value.data : null;
      const totalRoyaltyUsd = Number(statsData?.totalRevenue || 0);
      const withdrawnUsd = apiWithdrawals.filter((item: WithdrawalRecord) => item.status === 'paid').reduce((sum: number, item: WithdrawalRecord) => sum + item.amount, 0);
      const reservedUsd = apiWithdrawals.filter((item: WithdrawalRecord) => ['pending', 'under_review', 'approved', 'processing', 'paid'].includes(item.status)).reduce((sum: number, item: WithdrawalRecord) => sum + item.amount, 0);
      setRoyaltyTotals({
        totalStreams: Number(statsData?.totalStreams || 0),
        totalRoyaltyUsd,
        withdrawnUsd,
        availableUsd: Math.max(0, totalRoyaltyUsd - reservedUsd),
      });
    } catch (err) {
      console.error('Admin overview data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

  }, []);

  // Real Activity Data (aggregated from real streaming records and release submissions)
  const activityData = useMemo(() => {
    const map: Record<string, number> = {};
    streamingRecords.forEach((record) => {
      const key = record.reporting_period?.slice(0, 7);
      if (key) map[key] = (map[key] || 0) + Number(record.streams || 0);
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [streamingRecords]);

  // Real Payments Bar Chart Data (from genuine withdrawals)
  const paymentsData = useMemo(() => {
    const map: Record<string, number> = {};
    withdrawals.forEach((item) => {
      const dateKey = item.created_at?.slice(0, 10);
      if (dateKey) map[dateKey] = (map[dateKey] || 0) + item.amount;
    });
    const entries = Object.entries(map);
    return entries.map(([label, value], index) => ({ label, value: Math.round(value), active: index === entries.length - 1 }));
  }, [withdrawals]);

  // Real Platform Breakdown for Right Panel
  const platformBreakdown = useMemo(() => {
    const map: Record<string, { revenue: number; streams: number }> = {};
    streamingRecords.forEach(s => {
      const p = s.platform || 'Lainnya';
      if (!map[p]) map[p] = { revenue: 0, streams: 0 };
      map[p].revenue += Number(s.revenue || 0);
      map[p].streams += Number(s.streams || 0);
    });

    const entries = Object.entries(map);
    const totalRev = entries.reduce((sum, [, v]) => sum + v.revenue, 0);
    const totalStreams = entries.reduce((sum, [, v]) => sum + v.streams, 0);

    return entries.map(([name, data]) => ({
      name,
      amount: data.revenue,
      streams: data.streams,
      percentage: totalRev > 0
        ? Math.round((data.revenue / totalRev) * 100)
        : totalStreams > 0
          ? Math.round((data.streams / totalStreams) * 100)
          : 0,
      color: PLATFORM_COLORS[name] || '#A855F7',
    })).sort((a, b) => (b.amount !== a.amount ? b.amount - a.amount : b.streams - a.streams));
  }, [streamingRecords]);

  // Real Disbursement Percentage for Progress Ring
  const disbursedPct = royaltyTotals.totalRoyaltyUsd > 0
    ? Math.min(100, Math.round((royaltyTotals.withdrawnUsd / royaltyTotals.totalRoyaltyUsd) * 100))
    : 0;

  const adminName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Administrator');
  const userInitials = adminName.slice(0, 2).toUpperCase();

  return (
    <div className="w-full space-y-6 min-w-0 font-sans text-white select-none">

      {/* =========================================================================
          1. HEADER HORIZONTAL (PURSE COMPOSITION)
          [Title: Overview]  [Day] [Week] [Month] [Year]   [Search] [Bell with dot] [Admin Profile]
         ========================================================================= */}
      <header className="flex flex-wrap items-center justify-between gap-4 py-1">

        {/* LEFT: Mobile Menu Toggle + Title + Period Filter Pills */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-admin-mobile-menu'))}
            className="lg:hidden p-2 rounded-xl bg-[#1e1f25] border border-white/[0.05] text-gray-300 hover:text-white"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Overview
          </h1>

          {/* Time Filter Capsule: Day, Week, Month, Year */}
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

        {/* RIGHT: Search, Notification Bell with Orange Dot, Admin Profile */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          {/* Search Trigger */}
          <div className="relative">
            {searchOpen ? (
              <div className="flex items-center bg-[#1b1c22] border border-white/[0.08] rounded-full px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Cari rilis, user, ISRC..."
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

          {/* Notification Bell with Orange Dot Indicator */}
          <button
            onClick={() => navigate('/admin/releases')}
            className="relative w-9 h-9 rounded-full bg-[#1b1c22] border border-white/[0.04] flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF6A3D] ring-2 ring-[#1b1c22]" />
          </button>

          {/* Admin Profile Pill */}
          <div
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-[#1b1c22] border border-white/[0.04] hover:border-white/[0.1] transition-all cursor-pointer group"
          >
            <span className="text-xs sm:text-sm font-semibold text-white tracking-tight group-hover:text-orange-200 transition-colors">
              {adminName}
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#A855F7] to-[#FF6A3D] flex items-center justify-center text-white text-[11px] font-bold overflow-hidden border border-white/10 shadow-sm">
              <img
                src="/images/hero-singer.jpg"
                alt={adminName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="fallback-initials">{userInitials}</span>
            </div>
          </div>
        </div>

      </header>

      {/* =========================================================================
          2. ASYMMETRIC GRID (PURSE DESIGN)
          Left: 8 Cols (Wide Top Card + 2 Bottom Cards)
          Right: 4 Cols (Tall Panel with 68% Ring & Available Balance)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* LEFT COLUMN (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6 justify-between">

          {/* ---------------------------------------------------------------------
              TOP WIDE CARD ("My cards" / Platform Vault + "Recent transaction")
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
                  onClick={() => navigate('/admin/transactions')}
                  className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Split Content: Left Platform Vault Stack | Right Operational Activity */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">

              {/* LEFT HALF: Overlapping Stylized Platform Card Stack */}
              <div className="md:col-span-6 flex items-center justify-center py-2 overflow-hidden max-w-full pr-2">
                <div className="relative w-full max-w-[280px] sm:max-w-[290px] h-[175px] group rounded-[24px]" aria-label="Artist ID card">

                  {/* Back Card (Orange Glow Platform Vault Card) */}
                  <div className="absolute right-0 top-3 w-[88%] h-[155px] rounded-[22px] bg-gradient-to-tr from-[#FF6A3D] to-[#FF8C61] shadow-[0_12px_28px_rgba(255,106,61,0.3)] opacity-95 transform translate-x-2 sm:translate-x-3 translate-y-1 overflow-hidden p-4 flex flex-col justify-between transition-transform duration-300 group-hover:translate-x-2.5 sm:group-hover:translate-x-3.5 group-hover:translate-y-1.5">
                    <div className="flex justify-between items-center text-white/90">
                      <span className="text-[11px] font-bold tracking-wider">BREAKOUT MUSIC</span>
                      <Radio className="w-4 h-4 text-white/80" />
                    </div>
                    <div className="flex items-center justify-between text-white font-extrabold tracking-wider">
                      <span className="text-sm">ARTIST ID</span>
                      <span className="text-xs opacity-75">MEMBER CARD</span>
                    </div>
                  </div>

                  {/* Front Card (Frosted Glassmorphic Visa/Admin Card) */}
                  <div className="absolute left-0 top-0 w-[90%] h-[165px] rounded-[22px] bg-gradient-to-br from-[#2f313e]/90 via-[#22232c]/95 to-[#16171f]/95 border border-white/[0.12] shadow-2xl p-4 sm:p-5 flex flex-col justify-between backdrop-blur-md group-hover:scale-[1.02] transition-transform duration-300">
                    {/* Top Row: Release / Card Title + Gold Chip */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-gray-200 tracking-wide block truncate max-w-[150px]">
                          BREAKOUT MUSIC
                        </span>
                        <span className="text-[9px] text-[#A855F7] font-semibold tracking-wider uppercase">
                          ARTIST ID
                        </span>
                      </div>

                      {/* EMV / Audio Chip Icon */}
                      <div className="w-8 h-6 rounded-md bg-gradient-to-br from-[#E2B357] to-[#BA882F] p-0.5 shadow-sm flex items-center justify-center">
                        <div className="w-full h-full border border-amber-900/30 rounded-[3px] flex items-center justify-around px-0.5">
                          <span className="w-0.5 h-3 bg-amber-900/40" />
                          <span className="w-0.5 h-3 bg-amber-900/40" />
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Persistent account ID from the authenticated user record */}
                    <div className="space-y-0.5">
                      <p className="text-xs font-mono font-bold tracking-widest text-gray-300 truncate">
                        {user?.artistId ? `No: ${user.artistId}` : 'ID belum tersedia'}
                      </p>
                      <p className="text-[9px] text-[#8E92A0] font-mono tracking-tight truncate">
                        {user?.fullName || user?.email || 'Akun artis'}
                      </p>
                    </div>

                    {/* Bottom Row: Expiry & Bold VISA / Breakout Logo */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-gray-400">ARTIST ACCOUNT</span>
                      <span className="text-lg font-black tracking-tighter text-white font-sans italic">
                        BREAKOUT
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT HALF: Real Operational Transactions List (Withdrawals) */}
              <div className="md:col-span-6 space-y-3">
                {withdrawals.length === 0 ? (
                  <div className="text-center py-6 px-4 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                    <Download className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-gray-400">Belum ada transaksi</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Permintaan penarikan saldo artis akan muncul di sini.
                    </p>
                  </div>
                ) : (
                  withdrawals.slice(0, 4).map((tx) => {
                    const isPaid = tx.status === 'paid' || tx.status === 'approved';
                    const isRejected = tx.status === 'rejected';
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isPaid ? 'bg-emerald-500/10 text-emerald-400' : isRejected ? 'bg-rose-500/10 text-rose-400' : 'bg-orange-500/10 text-orange-400'
                          }`}>
                            <Download className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white tracking-tight truncate">
                              {tx.user_name || 'Artis'}
                            </p>
                            <p className="text-[10px] text-[#8E92A0] truncate">
                              {tx.channel} {tx.account_number ? `(•••• ${tx.account_number.slice(-4)})` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 pl-2">
                          <p className="text-xs font-bold font-mono text-white">
                            ${tx.amount.toFixed(2)} {tx.currency}
                          </p>
                          <span className={`text-[9px] font-semibold uppercase ${
                            isPaid ? 'text-emerald-400' : isRejected ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

          {/* ---------------------------------------------------------------------
              BOTTOM ROW: 2 Cards Side-by-Side (Activity Wave + Payments Bar Chart)
             --------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">

            {/* CARD 2: Activity (Stream Plays / Release Activity) */}
            <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[230px]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white tracking-tight">Activity</h3>
                <span className="text-[10px] font-semibold text-gray-500">
                  {royaltyTotals.totalStreams.toLocaleString()} plays
                </span>
              </div>

              {/* Chart */}
              <div className="w-full h-[155px] -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminPurpleGlow" x1="0" y1="0" x2="0" y2="1">
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
                      contentStyle={{ backgroundColor: '#1c1d23', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                      formatter={(val: any) => [`${val} plays`, 'Streams']}
                    />
                    <Line
                      type="natural"
                      dataKey="value"
                      stroke="#A855F7"
                      strokeWidth={3.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#A855F7', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CARD 3: Payments (Disbursements / Withdrawals Over Time) */}
            <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[230px]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white tracking-tight">Payments</h3>
                <span className="text-[10px] font-semibold text-gray-500">
                  ${royaltyTotals.withdrawnUsd.toFixed(2)} paid
                </span>
              </div>

              {/* Chart */}
              <div className="w-full h-[155px] -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentsData} margin={{ top: 25, right: 5, left: 5, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#787D8D', fontSize: 11, fontWeight: 500 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1c1d23', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                      formatter={(val: any) => [`$${val}`, 'Pencairan']}
                    />
                    <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={22}>
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
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN (lg:col-span-4): TALL VERTICAL PANEL */}
        <div className="lg:col-span-4">
          <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[28px] p-6 sm:p-7 shadow-xl flex flex-col justify-between h-full space-y-6">

            {/* TOP: Circular Progress Ring (Real Disbursed %) */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Background Track Circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    className="stroke-[#272832]"
                    strokeWidth="9"
                    fill="transparent"
                  />
                  {/* Active Neon Violet Progress Arc */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    className="stroke-[#A855F7]"
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - (disbursedPct / 100))}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Inner Text: Real %, Real Disbursed / Total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {disbursedPct}%
                  </span>
                  <span className="text-xs font-bold text-[#8E92A0] mt-0.5">
                    ${royaltyTotals.withdrawnUsd.toFixed(2)} / $${royaltyTotals.totalRoyaltyUsd.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium tracking-wide">
                    Royalti Dicairkan
                  </span>
                </div>
              </div>
            </div>

            {/* MIDDLE: Large Available Balance Display */}
            <div className="text-center space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ${royaltyTotals.availableUsd.toFixed(2)}
              </p>
              <p className="text-xs text-[#8E92A0] font-medium">
                Total Saldo Royalti Tersedia
              </p>
            </div>

            {/* SEGMENTED HORIZONTAL BAR */}
            <div className="w-full px-2">
              <div className="w-full h-2.5 rounded-full flex overflow-hidden bg-[#2a2b36]">
                <div
                  className="h-full bg-[#FF6A3D] rounded-l-full transition-all duration-500"
                  style={{ width: `${Math.min(100, disbursedPct)}%` }}
                />
                <div
                  className="h-full bg-[#A855F7] transition-all duration-500"
                  style={{ width: `${Math.max(0, 100 - disbursedPct)}%` }}
                />
              </div>
            </div>

            {/* BOTTOM: Breakdown by Real Platform */}
            <div className="space-y-3.5 pt-1">
              {platformBreakdown.length === 0 ? (
                <div className="text-center py-4 px-2 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Belum ada data streaming tercatat</p>
                  <button
                    onClick={() => navigate('/admin/streaming-royalty')}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    + Input Streaming &amp; Royalti
                  </button>
                </div>
              ) : (
                platformBreakdown.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-300 font-medium truncate max-w-[130px]">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-200">
                        {item.amount > 0 ? `$${item.amount.toFixed(2)}` : `${item.streams.toLocaleString()} plays`}
                      </span>
                      <span className="text-[10px] text-gray-500 ml-1.5 font-medium">{item.percentage}%</span>
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
