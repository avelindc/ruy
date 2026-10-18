import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Music, Layers, Calendar, Download, Search, ChevronDown, ChevronRight, ChevronLeft, MoreVertical, BarChart3, DollarSign, TrendingUp, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { getRoyaltyEntries, getRoyaltyCalculationItems } from '@services/royaltiesService';
import { getWithdrawalRequests, type WithdrawalRecord } from '@services/withdrawalService';
import { useAuth } from '@contexts/AuthContext';

// Platform theme colors
const PLATFORM_COLORS: Record<string, string> = {
  Spotify: '#1DB954',
  'Apple Music': '#FA243C',
  'YouTube Music': '#FF0000',
  'YouTube': '#FF0000',
  'TikTok': '#A855F7',
  'Amazon Music': '#FF9900',
  'Deezer': '#00C7F2',
  'Joox': '#00D1B2',
  'Lainnya': '#787D8D',
};

// Indonesian Month Labels
const MONTH_NAMES: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'Mei',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Agu',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Des',
};

function royaltyStatusLabel(status: DisplayRoyaltyRow['status']): string {
  if (status === 'paid') return 'Diterima';
  if (status === 'finalized') return 'Tersedia';
  return 'Diproses';
}

export interface DisplayRoyaltyRow {
  id: string;
  track_title: string;
  release_type: string;
  artist_name: string;
  release_title: string;
  isrc: string;
  platform: string;
  platforms_list: string[];
  streams: number;
  royalty_usd: number;
  period: string; // e.g. "Aug 2026" or "2026-08"
  period_raw: string;
  status: 'paid' | 'processing' | 'finalized';
  cover_url: string;
}

export default function RoyaltiesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Loading and Error State
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Raw Application Data
  const [records, setRecords] = useState<DisplayRoyaltyRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);

  // Filters
  const [selectedDateRange, setSelectedDateRange] = useState('Semua Periode');
  const [headerPlatformFilter, setHeaderPlatformFilter] = useState('Semua Platform');
  const [tableSearch, setTableSearch] = useState('');
  const [tablePlatformFilter, setTablePlatformFilter] = useState('Semua Platform');
  const [tableStatusFilter, setTableStatusFilter] = useState('Semua Status');
  const [chartMetric, setChartMetric] = useState<'royalty' | 'streams'>('royalty');

  // Table selection & pagination
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Dropdown menus
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load royalty and withdrawal records from the authenticated Worker API.
  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      if (!user?.id) {
        setRecords([]);
        setWithdrawals([]);
        return;
      }
      const [royaltyResult, calculationResult, withdrawalResult] = await Promise.all([
        getRoyaltyEntries(user.id),
        getRoyaltyCalculationItems(user.id),
        getWithdrawalRequests(user.id),
      ]);
      if (royaltyResult.error) throw royaltyResult.error;
      if (calculationResult.error) throw calculationResult.error;
      if (withdrawalResult.error) throw withdrawalResult.error;
      setWithdrawals(withdrawalResult.data);
      const calculationRows = (calculationResult.data || []).map((entry: any) => {
        const periodRaw = String(entry.period_start || '').slice(0, 7);
        const [year, month] = periodRaw.split('-');
        const periodDisplay = month && MONTH_SHORT[month] ? `${MONTH_SHORT[month]} ${year}` : periodRaw;
        const title = entry.track_title || '';
        const platform = String(entry.platform || '').replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
        return {
          id: entry.id,
          track_title: title,
          release_type: '',
          artist_name: entry.artist_name || '',
          release_title: entry.release_title || '',
          isrc: entry.isrc || '',
          platform,
          platforms_list: [platform],
          streams: Number(entry.streams || 0),
          royalty_usd: entry.currency === 'USD' ? Number(entry.amount || 0) : 0,
          period: periodDisplay,
          period_raw: periodRaw,
          status: 'finalized' as const,
          cover_url: '',
        };
      });
      const legacyRows = (royaltyResult.data || []).map((entry: any) => {
        const periodRaw = String(entry.reporting_period || '');
        const [year, month] = periodRaw.split('-');
        const periodDisplay = month && MONTH_SHORT[month] ? `${MONTH_SHORT[month]} ${year}` : periodRaw;
        const title = entry.song_name || entry.track?.title || '';
        return {
          id: entry.id,
          track_title: title,
          release_type: '',
          artist_name: '',
          release_title: title,
          isrc: entry.track?.isrc || entry.isrc || '',
          platform: 'Royalty agregat',
          platforms_list: [],
          streams: Number(entry.streams || 0),
          royalty_usd: Number(entry.amount || 0),
          period: periodDisplay,
          period_raw: periodRaw,
          status: entry.status === 'paid' ? 'paid' : entry.status === 'finalized' ? 'finalized' : 'processing',
          cover_url: '',
        };
      });
      setRecords(calculationRows.length ? calculationRows : legacyRows);
    } catch (err) {
      console.error('Error loading royalty reports:', err);
      setErrorMessage('Gagal memuat laporan royalti. Silakan periksa koneksi atau coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Available Platforms from genuine data
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.platform) set.add(r.platform);
    });
    return Array.from(set);
  }, [records]);

  // Filter records by header controls (Date Range & Header Platform Filter)
  const headerFilteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Platform filter
      if (headerPlatformFilter !== 'Semua Platform') {
        if ((r.platform || '').toLowerCase() !== headerPlatformFilter.toLowerCase()) {
          return false;
        }
      }

      // Date Range filter
      if (selectedDateRange === 'Tahun 2026') {
        if (!r.period_raw.includes('2026') && !r.period.includes('2026')) return false;
      } else if (selectedDateRange === 'Tahun 2025') {
        if (!r.period_raw.includes('2025') && !r.period.includes('2025')) return false;
      } else if (selectedDateRange === 'Kuartal 3 2026') {
        const p = r.period_raw;
        if (!['2026-07', '2026-08', '2026-09'].some(m => p.includes(m))) return false;
      } else if (selectedDateRange === 'Kuartal 2 2026') {
        const p = r.period_raw;
        if (!['2026-04', '2026-05', '2026-06'].some(m => p.includes(m))) return false;
      } else if (selectedDateRange === 'Kuartal 1 2026') {
        const p = r.period_raw;
        if (!['2026-01', '2026-02', '2026-03'].some(m => p.includes(m))) return false;
      }

      return true;
    });
  }, [records, headerPlatformFilter, selectedDateRange]);

  // Derived Genuine Metrics
  const metrics = useMemo(() => {
    const list = headerFilteredRecords;
    const totalRoyaltyUsd = list.reduce((sum, r) => sum + (r.royalty_usd || 0), 0);

    // Distinct tracks with qualifying royalties
    const distinctTracks = new Set(
      list.filter(r => r.royalty_usd > 0 || r.streams > 0).map(r => r.track_title.trim().toLowerCase())
    );

    // Distinct platforms
    const distinctPlatforms = new Set(
      list.map(r => r.platform.trim())
    );

    // Verified completed/paid disbursements
    const paidWithdrawals = withdrawals.filter(w => w.status === 'paid' && w.currency === 'USD');
    const verifiedPaymentUsd = paidWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const paymentTransactionsCount = paidWithdrawals.length;

    return {
      totalRoyaltyUsd,
      trackCount: distinctTracks.size,
      platformCount: distinctPlatforms.size,
      verifiedPaymentUsd,
      paymentTransactionsCount,
    };
  }, [headerFilteredRecords, withdrawals]);

  // Royalty Trend Chart Data (Real Aggregation by Period)
  const trendData = useMemo<Array<{ month: string; label: string; royalty: number; streams: number }>>(() => {
    if (headerFilteredRecords.length === 0) return [];

    // Group by period
    const map: Record<string, { month: string; label: string; royalty: number; streams: number }> = {};

    headerFilteredRecords.forEach(r => {
      const p = r.period_raw || r.period || 'Lainnya';
      let monthLabel = p;
      let monthShort = p;

      if (p.includes('-')) {
        const [yr, mo] = p.split('-');
        monthShort = MONTH_SHORT[mo] || mo;
        monthLabel = `${MONTH_NAMES[mo] || mo} ${yr}`;
      } else if (r.period) {
        monthShort = r.period.split(' ')[0] || r.period;
        monthLabel = r.period;
      }

      if (!map[p]) {
        map[p] = {
          month: monthShort,
          label: monthLabel,
          royalty: 0,
          streams: 0,
        };
      }

      map[p].royalty += Number(r.royalty_usd || 0);
      map[p].streams += Number(r.streams || 0);
    });

    const list = Object.values(map);
    list.forEach(item => {
      item.royalty = Number(item.royalty.toFixed(2));
    });

    return list;
  }, [headerFilteredRecords]);

  // Dynamic Peak Month Identification
  const peakPoint = useMemo(() => {
    if (trendData.length === 0) return null;
    const maxIndex = trendData.reduce((bestIndex, item, index, items) => {
      const bestValue = chartMetric === 'royalty' ? items[bestIndex].royalty : items[bestIndex].streams;
      const currentValue = chartMetric === 'royalty' ? item.royalty : item.streams;
      return currentValue > bestValue ? index : bestIndex;
    }, 0);
    const maxItem = trendData[maxIndex];
    const maxVal = maxItem ? chartMetric === 'royalty' ? maxItem.royalty : maxItem.streams : 0;
    if (!maxItem || maxVal <= 0) return null;

    // Calculate approximate X percentage for callout badge
    const leftPercent = ((maxIndex + 0.5) / trendData.length) * 100;

    return {
      item: maxItem,
      value: maxVal,
      leftPercent: Math.min(88, Math.max(12, leftPercent)),
    };
  }, [trendData, chartMetric]);

  // Platform Breakdown Donut Chart
  const platformBreakdown = useMemo(() => {
    const platformMap: Record<string, number> = {};
    headerFilteredRecords.forEach(r => {
      const p = r.platform || 'Lainnya';
      platformMap[p] = (platformMap[p] || 0) + (r.royalty_usd || 0);
    });

    const entries = Object.entries(platformMap);
    const total = entries.reduce((sum, [, val]) => sum + val, 0);

    if (total === 0) return [];

    return entries
      .map(([name, val], idx) => {
        const pct = Math.round((val / total) * 100);
        return {
          name,
          value: Number(val.toFixed(2)),
          percentage: pct,
          color: PLATFORM_COLORS[name] || ['#8B5CF6', '#FF6A3D', '#EC4899', '#6366F1', '#14B8A6'][idx % 5],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [headerFilteredRecords]);

  // Table Filtering (Search, Platform, Status)
  const filteredTableRows = useMemo(() => {
    return headerFilteredRecords.filter((item) => {
      if (!item) return false;
      const q = (tableSearch || '').trim().toLowerCase();

      // Search match
      const matchesSearch =
        !q ||
        item.track_title.toLowerCase().includes(q) ||
        item.artist_name.toLowerCase().includes(q) ||
        item.release_title.toLowerCase().includes(q) ||
        item.isrc.toLowerCase().includes(q);

      // Table Platform match
      const matchesPlatform =
        tablePlatformFilter === 'Semua Platform' ||
        item.platform.toLowerCase() === tablePlatformFilter.toLowerCase();

      // Table Status match
      const itemStatusLabel = royaltyStatusLabel(item.status);
      const matchesStatus =
        tableStatusFilter === 'Semua Status' ||
        itemStatusLabel === tableStatusFilter;

      return matchesSearch && matchesPlatform && matchesStatus;
    });
  }, [headerFilteredRecords, tableSearch, tablePlatformFilter, tableStatusFilter]);

  // Table Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTableRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTableRows.slice(start, start + itemsPerPage);
  }, [filteredTableRows, currentPage]);

  // Checkbox Selection
  const toggleSelectAll = () => {
    if (selectedRowIds.length === paginatedRows.length && paginatedRows.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(paginatedRows.map(r => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Copy ISRC helper
  const handleCopyIsrc = (isrc: string, id: string) => {
    navigator.clipboard.writeText(isrc);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Authentic CSV Export
  const handleExportCSV = () => {
    if (filteredTableRows.length === 0) {
      alert('Tidak ada data royalti yang tersedia untuk diekspor pada filter yang dipilih.');
      return;
    }

    const headers = [
      'Track Title',
      'Artist',
      'Release',
      'ISRC',
      'Platform',
      'Streams',
      'Gross Royalty (USD)',
      'Reporting Period',
      'Payment Status',
    ];

    const rows = filteredTableRows.map(r => [
      `"${(r.track_title || '').replace(/"/g, '""')}"`,
      `"${(r.artist_name || '').replace(/"/g, '""')}"`,
      `"${(r.release_title || '').replace(/"/g, '""')}"`,
      `"${r.isrc || ''}"`,
      `"${r.platform || ''}"`,
      r.streams || 0,
      Number(r.royalty_usd || 0).toFixed(2),
      `"${r.period || ''}"`,
      `"${royaltyStatusLabel(r.status)}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `breakout-royalty-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="text-white font-sans w-full max-w-[1600px] mx-auto space-y-6 pb-16">

      {/* =========================================================================
          PAGE HEADER: Title, Date Range Selector, Platform Filter, Ekspor Laporan
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Royalti
          </h1>
          <p className="text-xs sm:text-sm text-[#8E92A0] mt-1">
            Laporan dan pembayaran royalti dari seluruh platform streaming Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          {/* Date Range Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#1c1d23] border border-white/[0.04] text-xs font-semibold text-gray-300 shadow-sm cursor-pointer hover:border-white/[0.08] transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{selectedDateRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
            </button>

            {showDateDropdown && (
              <div className="absolute right-0 top-12 w-48 bg-[#181920] border border-white/[0.08] rounded-2xl shadow-2xl p-1.5 z-30 animate-fadeIn">
                {['Semua Periode', 'Tahun 2026', 'Tahun 2025', 'Kuartal 3 2026', 'Kuartal 2 2026', 'Kuartal 1 2026'].map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setSelectedDateRange(range);
                      setShowDateDropdown(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                      selectedDateRange === range
                        ? 'bg-purple-600/30 text-purple-200 font-bold'
                        : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Header Platform Filter */}
          <select
            value={headerPlatformFilter}
            onChange={(e) => {
              setHeaderPlatformFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-[#1c1d23] border border-white/[0.04] text-xs font-semibold text-gray-300 shadow-sm focus:outline-none focus:border-purple-500/50 cursor-pointer"
          >
            <option value="Semua Platform">Semua Platform</option>
            {availablePlatforms.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
            {availablePlatforms.length === 0 && (
              <>
                <option value="Spotify">Spotify</option>
                <option value="Apple Music">Apple Music</option>
                <option value="YouTube Music">YouTube Music</option>
                <option value="TikTok">TikTok</option>
              </>
            )}
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            title="Muat ulang data"
            className="p-2.5 rounded-2xl bg-[#1c1d23] border border-white/[0.04] text-gray-400 hover:text-white hover:border-white/[0.08] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {/* Ekspor Laporan Button (Orange Gradient matching design reference) */}
          <button
            onClick={handleExportCSV}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF6A3D] to-[#FF8C61] hover:opacity-95 text-white text-xs font-bold transition-all shadow-[0_6px_20px_rgba(255,106,61,0.35)] hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Laporan</span>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 text-red-200 text-xs">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="flex-1">{errorMessage}</p>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-white font-bold transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* =========================================================================
          SUMMARY CARDS: 4 Genuine Value Cards
          1. Total Royalti
          2. Jumlah Track
          3. Jumlah Platform
          4. Pembayaran Diterima
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

        {/* Card 1: Total Royalti */}
        <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[24px] p-5 sm:p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-[#A855F7] border border-purple-500/30 flex items-center justify-center flex-shrink-0 shadow-md">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[#8E92A0] font-medium block">Total Royalti</span>
            <div className="text-2xl font-black text-white tracking-tight mt-0.5">
              ${Number(metrics.totalRoyaltyUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium mt-1">
              {metrics.totalRoyaltyUsd > 0 ? (
                <span className="text-gray-500 text-[10px]">dari data royalti tersimpan</span>
              ) : (
                <span className="text-gray-500 text-[10px]">Belum ada royalti dilaporkan</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Jumlah Track */}
        <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[24px] p-5 sm:p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6A3D]/20 text-[#FF6A3D] border border-[#FF6A3D]/30 flex items-center justify-center flex-shrink-0 shadow-md">
            <Music className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[#8E92A0] font-medium block">Jumlah Track</span>
            <div className="text-2xl font-black text-white tracking-tight mt-0.5">
              {metrics.trackCount}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium mt-1">
              {metrics.trackCount > 0 ? (
                <span className="text-emerald-400 text-[10px]">track dengan royalti</span>
              ) : (
                <span className="text-gray-500 text-[10px]">Belum ada track terdistribusi</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Jumlah Platform */}
        <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[24px] p-5 sm:p-6 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30 flex items-center justify-center flex-shrink-0 shadow-md">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[#8E92A0] font-medium block">Jumlah Platform</span>
            <div className="text-2xl font-black text-white tracking-tight mt-0.5">
              {metrics.platformCount}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium mt-1">
              {metrics.platformCount > 0 ? (
                <span className="text-emerald-400 text-[10px]">platform terdeteksi</span>
              ) : (
                <span className="text-gray-500 text-[10px]">Belum ada data DSP</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Pembayaran Diterima (Verified Real Disbursements) */}
        <div
          onClick={() => navigate('/dashboard/withdrawals')}
          className="bg-[#1c1d23] border border-white/[0.04] rounded-[24px] p-5 sm:p-6 shadow-xl flex items-center justify-between gap-4 cursor-pointer hover:border-white/[0.08] transition-all group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-[#FF6A3D] border border-orange-500/30 flex items-center justify-center flex-shrink-0 shadow-md">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-[#8E92A0] font-medium block">Pembayaran Diterima</span>
              <div className="text-2xl font-black text-white tracking-tight mt-0.5">
                ${Number(metrics.verifiedPaymentUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {metrics.paymentTransactionsCount > 0
                  ? `Dari ${metrics.paymentTransactionsCount} pembayaran`
                  : 'Belum ada transaksi cair'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
        </div>

      </div>

      {/* =========================================================================
          MIDDLE ROW: Tren Royalti Chart (Left 65%) + Royalti per Platform (Right 35%)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">

        {/* LEFT: Tren Royalti Chart */}
        <div className="lg:col-span-7 xl:col-span-8 bg-[#1c1d23] border border-white/[0.04] rounded-[26px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">

          {/* Header & Metric Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Tren Royalti</h2>
              <p className="text-[11px] text-[#8E92A0] mt-0.5">Grafik pendapatan dan jumlah putar lagu</p>
            </div>

            {/* Toggle Royalti vs Streams */}
            <div className="flex items-center p-1 rounded-xl bg-[#141419] border border-white/[0.04] text-xs font-semibold">
              <button
                onClick={() => setChartMetric('royalty')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'royalty'
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Royalti
              </button>
              <button
                onClick={() => setChartMetric('streams')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'streams'
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Streams
              </button>
            </div>
          </div>

          {/* Area Chart or Empty State */}
          <div className="relative w-full h-[250px] mt-2 flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs">Memuat data grafik tren...</span>
              </div>
            ) : trendData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-6 bg-[#141419]/50 rounded-2xl border border-white/[0.03] w-full h-full">
                <TrendingUp className="w-10 h-10 text-gray-600 mb-2 opacity-50" />
                <p className="text-xs font-bold text-white">Belum Ada Data Tren Royalti</p>
                <p className="text-[11px] text-gray-500 max-w-sm mt-1">
                  Data grafik tren pendapatan akan otomatis terisi saat laporan streaming bulanan dari DSP telah diimpor ke sistem.
                </p>
              </div>
            ) : (
              <>
                {/* Dynamic Peak Callout Badge */}
                {peakPoint && (
                  <div
                    className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full"
                    style={{ left: `${peakPoint.leftPercent}%`, top: '22%' }}
                  >
                    <div className="bg-[#121318]/95 border border-purple-500/40 rounded-xl px-2.5 py-1 shadow-2xl backdrop-blur-md text-center">
                      <p className="text-[10px] text-gray-400 font-medium">{peakPoint.item.label}</p>
                      <p className="text-xs font-bold text-white tracking-wide font-mono">
                        {chartMetric === 'royalty'
                          ? `$${peakPoint.value.toFixed(2)}`
                          : `${peakPoint.value.toLocaleString()} plays`}
                      </p>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-white border-2 border-[#FF6A3D] ring-4 ring-orange-500/30 mx-auto mt-1" />
                    <div className="w-[1px] h-20 border-l border-dashed border-purple-500/40 mx-auto" />
                  </div>
                )}

                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      {/* Gradient wave fill */}
                      <linearGradient id="royaltyWaveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF6A3D" stopOpacity={0.35} />
                        <stop offset="50%" stopColor="#A855F7" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.0} />
                      </linearGradient>

                      {/* Stroke gradient */}
                      <linearGradient id="royaltyStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#A855F7" />
                        <stop offset="60%" stopColor="#FF6A3D" />
                        <stop offset="100%" stopColor="#FF8C61" />
                      </linearGradient>
                    </defs>

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#787D8D', fontSize: 11 }}
                      tickFormatter={(val) => chartMetric === 'royalty' ? `$${val}` : `${val}`}
                    />

                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#787D8D', fontSize: 11 }}
                      dy={5}
                    />

                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#121318]/95 border border-purple-500/30 px-3 py-1.5 rounded-xl shadow-xl text-center text-xs">
                              <p className="text-gray-400 font-medium">{data.label}</p>
                              <p className="text-sm font-bold text-white font-mono mt-0.5">
                                {chartMetric === 'royalty' ? `$${data.royalty.toFixed(2)}` : `${data.streams.toLocaleString()} plays`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey={chartMetric === 'royalty' ? 'royalty' : 'streams'}
                      stroke="url(#royaltyStrokeGrad)"
                      strokeWidth={2.8}
                      fill="url(#royaltyWaveGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#FF6A3D', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

        </div>

        {/* RIGHT: Royalti per Platform */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#1c1d23] border border-white/[0.04] rounded-[26px] p-6 sm:p-7 shadow-xl flex flex-col justify-between">

          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Royalti per Platform</h2>
              <p className="text-[11px] text-[#8E92A0]">Distribusi sumber pendapatan</p>
            </div>
            <span className="text-[11px] font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              {platformBreakdown.length} Platform
            </span>
          </div>

          {/* Donut Chart or Clean Empty State */}
          <div className="relative w-44 h-44 mx-auto my-1 flex-shrink-0 flex items-center justify-center">
            {platformBreakdown.length === 0 ? (
              <div className="w-36 h-36 rounded-full border-4 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-center p-2">
                <span className="text-lg font-bold text-gray-500">$0.00</span>
                <span className="text-[10px] text-gray-500">Belum ada data</span>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={74}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {platformBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-extrabold text-white tracking-tight">
                    ${Number(metrics.totalRoyaltyUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-[#8E92A0] font-medium">
                    Total Royalti
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Platform Contribution List */}
          <div className="space-y-2.5 mt-3 text-xs">
            {platformBreakdown.length === 0 ? (
              <p className="text-center text-gray-500 text-xs py-3">
                Laporan distribusi dari platform streaming belum tersedia.
              </p>
            ) : (
              platformBreakdown.slice(0, 6).map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-300 font-medium truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-white font-bold">${Number(item.value).toFixed(2)}</span>
                    <span className="text-[#8E92A0] w-7 text-right">{item.percentage}%</span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* =========================================================================
          BOTTOM ROW: Daftar Royalti per Track Table
         ========================================================================= */}
      <div className="bg-[#1c1d23] border border-white/[0.04] rounded-[26px] overflow-hidden shadow-xl">

        {/* Table Header & Controls */}
        <div className="p-6 border-b border-white/[0.04] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Daftar Royalti per Track</h3>
            <p className="text-xs text-[#8E92A0]">
              Detail pendapatan royalti berdasarkan track dan platform streaming.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-56 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari judul lagu, artis, atau ISRC..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#131417] text-white text-xs pl-8 pr-3 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50 placeholder:text-gray-500"
              />
            </div>

            {/* Platform Filter */}
            <select
              value={tablePlatformFilter}
              onChange={(e) => {
                setTablePlatformFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#131417] text-white text-xs px-3 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="Semua Platform">Semua Platform</option>
              {availablePlatforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
              {availablePlatforms.length === 0 && (
                <>
                  <option value="Spotify">Spotify</option>
                  <option value="Apple Music">Apple Music</option>
                  <option value="YouTube Music">YouTube Music</option>
                </>
              )}
            </select>

            {/* Status Filter */}
            <select
              value={tableStatusFilter}
              onChange={(e) => {
                setTableStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#131417] text-white text-xs px-3 py-2 rounded-xl border border-white/[0.06] focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="Semua Status">Semua Status</option>
              <option value="Diterima">Diterima</option>
              <option value="Tersedia">Tersedia</option>
              <option value="Diproses">Diproses</option>
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
                    checked={selectedRowIds.length === paginatedRows.length && paginatedRows.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-transparent text-purple-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4">Track</th>
                <th className="py-4 px-4">Artis</th>
                <th className="py-4 px-4">Rilisan</th>
                <th className="py-4 px-4">ISRC</th>
                <th className="py-4 px-4">Platform</th>
                <th className="py-4 px-4 text-right">Streams</th>
                <th className="py-4 px-4 text-right">Royalti (USD)</th>
                <th className="py-4 px-4">Periode</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-center w-12">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.03]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-gray-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <DollarSign className="w-10 h-10 text-gray-500 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-white text-sm">Tidak Ada Laporan Royalti</p>
                      <p className="text-xs text-gray-500">
                        {records.length === 0
                          ? 'Belum ada laporan royalti streaming yang dicatat untuk akun Anda. Data akan otomatis masuk saat distributor memproses rekonsiliasi bulanan.'
                          : 'Tidak ada data royalti yang sesuai dengan kata kunci pencarian atau filter platform/status terpilih.'}
                      </p>
                      {records.length === 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => navigate('/dashboard/releases/new')}
                            className="px-4 py-2 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/50 text-xs font-semibold transition-colors"
                          >
                            Rilis Lagu Baru
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isSelected = selectedRowIds.includes(row.id);
                  const isPaid = row.status === 'paid';

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-purple-500/[0.04]' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(row.id)}
                          className="rounded border-white/20 bg-transparent text-purple-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Track Title with Release Type */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white whitespace-nowrap">{row.track_title}</p>
                        <p className="text-[10px] text-[#8E92A0] font-mono">{row.release_type}</p>
                      </td>

                      {/* Artis */}
                      <td className="py-3.5 px-4 text-gray-300 whitespace-nowrap">
                        {row.artist_name}
                      </td>

                      {/* Rilisan */}
                      <td className="py-3.5 px-4 text-[#8E92A0] whitespace-nowrap">
                        {row.release_title}
                      </td>

                      {/* ISRC */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 group/isrc">
                          <span>{row.isrc}</span>
                          <button
                            onClick={() => handleCopyIsrc(row.isrc, row.id)}
                            className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover/isrc:opacity-100"
                            title="Salin ISRC"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {copiedId === row.id && (
                            <span className="text-[9px] text-purple-300 font-sans">Tersalin</span>
                          )}
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                          style={{
                            backgroundColor: `${PLATFORM_COLORS[row.platform] || '#8B5CF6'}18`,
                            color: PLATFORM_COLORS[row.platform] || '#A855F7',
                            borderColor: `${PLATFORM_COLORS[row.platform] || '#8B5CF6'}35`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[row.platform] || '#A855F7' }} />
                          {row.platform}
                        </span>
                      </td>

                      {/* Streams */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-right whitespace-nowrap">
                        {Number(row.streams || 0).toLocaleString()}
                      </td>

                      {/* Royalti */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-right whitespace-nowrap">
                        <div className="text-white">
                          ${Number(row.royalty_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Periode */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-300 whitespace-nowrap">
                        {row.period}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPaid ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Diterima
                          </span>
                        ) : row.status === 'finalized' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Tersedia
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            Diproses
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}
                          className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer mx-auto"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === row.id && (
                          <div className="absolute right-6 top-10 w-44 bg-[#181920] border border-white/[0.08] rounded-2xl shadow-2xl p-1.5 z-30 text-left animate-fadeIn">
                            <button
                              onClick={() => {
                                navigate('/dashboard/analytics');
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Lihat Analitik</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/dashboard/withdrawals');
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Tarik Royalti</span>
                            </button>
                            <button
                              onClick={() => {
                                handleCopyIsrc(row.isrc, row.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-purple-400" />
                              <span>Salin ISRC</span>
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

        {/* Table Footer: Pagination & Counter */}
        <div className="p-4 sm:p-5 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span className="text-[#8E92A0] font-mono">
            Menampilkan {filteredTableRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredTableRows.length)} dari {filteredTableRows.length} track
          </span>

          {/* Pagination buttons */}
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

    </div>
  );
}
