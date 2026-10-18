import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ChevronDown,
  Check,
  TrendingUp,
  Coins,
  History,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Calculator,
  Filter,
  Settings,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '@lib/api/client';

type ArtistOption = {
  id: string;
  artist_name: string;
  owner_email: string;
  account_artist_id?: string;
};

type StreamingRow = {
  id: string;
  artist_id: string;
  artist_name: string;
  owner_email?: string;
  account_artist_id?: string;
  platform: string;
  period_start: string;
  period_end: string;
  streams: number;
  territory?: string;
  gross_revenue?: string | number;
  currency?: string;
  report_identifier?: string;
  notes?: string;
  source: string;
  version: number;
  created_at: string;
};

type RoyaltyRow = {
  id: string;
  artist_id: string;
  artist_name: string;
  owner_email?: string;
  account_artist_id?: string;
  period_start: string;
  period_end: string;
  streams?: number;
  gross_revenue?: string | number;
  deductions: string | number;
  net_royalty: string | number;
  currency: string;
  status: 'draft' | 'finalized' | 'superseded';
  report_identifier?: string;
  notes?: string;
  supersedes_id?: string;
  revision: number;
  created_at: string;
};

type Tab = 'streaming' | 'royalty' | 'history';

function parseIndonesianNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  let s = String(input).trim().replace(/^(Rp\.?|IDR|\$|€|£)\s*/i, '');
  if (!s) return 0;
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts.join('');
    } else if (parts[1].length === 3) {
      // In Indonesian currency, 3 digits after dot is thousand separator: e.g. 100.000 or 1.500.000
      s = parts.join('');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length > 2) {
      s = parts.join('');
    } else if (parts[1].length === 3) {
      s = parts.join('');
    } else {
      s = parts.join('.');
    }
  }
  const val = parseFloat(s);
  return isNaN(val) ? 0 : Math.max(0, val);
}

function formatIdr(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '0';
  const isInteger = Math.floor(num) === num;
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const todayMonth = new Date().toISOString().slice(0, 7);

const monthStart = (month: string) => `${month}-01`;
const monthEnd = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
};

const getPreviousMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

interface ArtistSearchSelectProps {
  artists: ArtistOption[];
  value: string;
  onChange: (artistId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

function ArtistSearchSelect({
  artists,
  value,
  onChange,
  disabled = false,
  placeholder = 'Pilih artis dari katalog...',
  label = 'Artis dari katalog',
  required = true,
}: ArtistSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedArtist = useMemo(() => artists.find((a) => a.id === value), [artists, value]);

  const filteredArtists = useMemo(() => {
    if (!search.trim()) return artists;
    const q = search.toLowerCase();
    return artists.filter(
      (a) =>
        a.artist_name.toLowerCase().includes(q) ||
        a.owner_email.toLowerCase().includes(q) ||
        (a.account_artist_id && a.account_artist_id.toLowerCase().includes(q))
    );
  }, [artists, search]);

  return (
    <div ref={wrapperRef} className="relative grid gap-1.5 text-sm text-[#C5C7CF]">
      <label className="flex items-center gap-1 font-medium text-[#C5C7CF]">
        {label} {required && <span className="text-[#FF6A3D]">*</span>}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-left text-white transition hover:border-white/20 focus:border-[#FF6A3D] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedArtist ? (
          <div className="flex flex-col truncate pr-2">
            <span className="font-semibold text-white">{selectedArtist.artist_name}</span>
            <span className="text-xs text-[#8E92A0]">
              {selectedArtist.account_artist_id ? `ID: ${selectedArtist.account_artist_id} · ` : ''}
              {selectedArtist.owner_email}
            </span>
          </div>
        ) : (
          <span className="text-[#6D7180]">{placeholder}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#8E92A0] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-white/10 bg-[#17181e] shadow-2xl backdrop-blur-md">
          <div className="border-b border-white/[0.08] p-2">
            <div className="flex items-center gap-2 rounded-lg bg-[#101116] px-3 py-2 text-sm">
              <Search className="h-4 w-4 shrink-0 text-[#757A88]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari artis, email, atau Artist ID..."
                className="w-full bg-transparent text-white placeholder-[#5A5E6D] focus:outline-none"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded px-1 text-xs text-[#8E92A0] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {artists.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8E92A0]">
                Belum ada artis terdaftar yang memiliki rilisan di katalog.
              </div>
            ) : filteredArtists.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8E92A0]">
                Tidak ada artis yang cocok dengan &ldquo;{search}&rdquo;.
              </div>
            ) : (
              filteredArtists.map((artist) => {
                const isSelected = artist.id === value;
                return (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => {
                      onChange(artist.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left text-sm transition ${
                      isSelected
                        ? 'bg-[#FF6A3D]/20 text-[#FF8C69]'
                        : 'text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold text-white">{artist.artist_name}</div>
                      <div className="text-xs text-[#8E92A0]">
                        {artist.account_artist_id ? `Artist ID ${artist.account_artist_id} · ` : ''}
                        {artist.owner_email}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#FF6A3D]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StreamingRoyaltyManagement() {
  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    queryTab === 'royalty' ? 'royalty' : queryTab === 'history' ? 'history' : 'streaming'
  );

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab === 'royalty' || qTab === 'history' || qTab === 'streaming') {
      setTab(qTab);
    }
  }, [searchParams]);

  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [streamingRows, setStreamingRows] = useState<StreamingRow[]>([]);
  const [royaltyRows, setRoyaltyRows] = useState<RoyaltyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [streamingEditId, setStreamingEditId] = useState('');
  const [royaltyCorrectionId, setRoyaltyCorrectionId] = useState('');

  // Filters for History Tab
  const [filterArtist, setFilterArtist] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Form Streaming State
  const [streamingMode, setStreamingMode] = useState<'aggregate' | 'platform'>('aggregate');
  const [streamArtist, setStreamArtist] = useState('');
  const [platform, setPlatform] = useState('Spotify');
  const [streamStart, setStreamStart] = useState(monthStart(todayMonth));
  const [streamEnd, setStreamEnd] = useState(monthEnd(todayMonth));
  const [streams, setStreams] = useState('');
  const [territory, setTerritory] = useState('');
  const [streamGross, setStreamGross] = useState('');
  const [streamCurrency, setStreamCurrency] = useState('IDR');
  const [streamReportId, setStreamReportId] = useState('');
  const [streamNotes, setStreamNotes] = useState('');

  // Form Royalty State
  const [royaltyArtist, setRoyaltyArtist] = useState('');
  const [royaltyStart, setRoyaltyStart] = useState(monthStart(todayMonth));
  const [royaltyEnd, setRoyaltyEnd] = useState(monthEnd(todayMonth));
  const [royaltyStreams, setRoyaltyStreams] = useState('');
  const [gross, setGross] = useState('');
  const [deductionPercent, setDeductionPercent] = useState('30');
  const [deductions, setDeductions] = useState('0');
  const [netRoyalty, setNetRoyalty] = useState('');
  const [royaltyCurrency, setRoyaltyCurrency] = useState('IDR');
  const [royaltyStatus, setRoyaltyStatus] = useState<'draft' | 'finalized'>('draft');
  const [royaltyReportId, setRoyaltyReportId] = useState('');
  const [royaltyNotes, setRoyaltyNotes] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (filterArtist) params.set('artist_id', filterArtist);
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterMonth) {
        params.set('start_date', monthStart(filterMonth));
        params.set('end_date', monthEnd(filterMonth));
      }
      const royaltyParams = new URLSearchParams(params);
      royaltyParams.delete('platform');
      royaltyParams.set('include_superseded', 'true');

      const [artistResponse, streamingResponse, royaltyResponse] = await Promise.all([
        apiGet<any>('/api/admin/artist-finance/artists'),
        apiGet<any>(`/api/admin/artist-finance/streaming?${params}`),
        apiGet<any>(`/api/admin/artist-finance/royalties?${royaltyParams}`),
      ]);

      if (!artistResponse.success || !streamingResponse.success || !royaltyResponse.success) {
        throw new Error(
          artistResponse.error ||
            streamingResponse.error ||
            royaltyResponse.error ||
            'Gagal memuat data streaming dan royalti.'
        );
      }

      const artistRows = artistResponse.data || [];
      setArtists(artistRows);
      setStreamingRows(streamingResponse.data?.data || []);
      setRoyaltyRows(royaltyResponse.data?.data || []);

      if (!streamArtist && artistRows[0]?.id) setStreamArtist(artistRows[0].id);
      if (!royaltyArtist && artistRows[0]?.id) setRoyaltyArtist(artistRows[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat data streaming dan royalti.');
    } finally {
      setLoading(false);
    }
  }, [filterArtist, filterPlatform, filterMonth, streamArtist, royaltyArtist]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Streaming aggregation logic: separates aggregate records and individual platform records
  const streamingSummaryForRoyalty = useMemo(() => {
    if (!royaltyArtist) {
      return { total: 0, hasAggregate: false, platforms: [] as { platform: string; streams: number }[], isMixed: false };
    }
    const relevant = streamingRows.filter(
      (row) =>
        row.artist_id === royaltyArtist &&
        row.period_start <= royaltyEnd &&
        row.period_end >= royaltyStart
    );
    const aggregateRows = relevant.filter(
      (r) => r.platform.toLowerCase() === 'agregat' || r.platform.toLowerCase() === 'all'
    );
    const platformRows = relevant.filter(
      (r) => r.platform.toLowerCase() !== 'agregat' && r.platform.toLowerCase() !== 'all'
    );

    const aggregateTotal = aggregateRows.reduce((sum, r) => sum + Number(r.streams || 0), 0);
    const platformTotal = platformRows.reduce((sum, r) => sum + Number(r.streams || 0), 0);

    const platformMap = new Map<string, number>();
    for (const r of platformRows) {
      platformMap.set(r.platform, (platformMap.get(r.platform) || 0) + Number(r.streams || 0));
    }
    const platforms = Array.from(platformMap.entries()).map(([plat, count]) => ({ platform: plat, streams: count }));

    // Rule: if aggregate record exists, use aggregate to prevent double-counting
    if (aggregateRows.length > 0) {
      return {
        total: aggregateTotal,
        hasAggregate: true,
        platforms,
        isMixed: platformRows.length > 0,
      };
    }

    return {
      total: platformTotal,
      hasAggregate: false,
      platforms,
      isMixed: false,
    };
  }, [streamingRows, royaltyArtist, royaltyStart, royaltyEnd]);

  // Automatically update royaltyStreams when streaming summary updates
  useEffect(() => {
    if (streamingSummaryForRoyalty.total > 0 && !royaltyCorrectionId) {
      setRoyaltyStreams(formatIdr(streamingSummaryForRoyalty.total));
    }
  }, [streamingSummaryForRoyalty.total, royaltyCorrectionId]);

  const resetStreaming = (keepArtistAndPeriod = false) => {
    setStreamingEditId('');
    setStreams('');
    setTerritory('');
    setStreamGross('');
    setStreamCurrency('IDR');
    setStreamReportId('');
    setStreamNotes('');
    if (!keepArtistAndPeriod) {
      setStreamStart(monthStart(todayMonth));
      setStreamEnd(monthEnd(todayMonth));
    }
  };

  const saveStreaming = async (event: FormEvent) => {
    event.preventDefault();
    if (!streamArtist) {
      setError('Pilih artis katalog terlebih dahulu.');
      return;
    }
    const parsedStreams = parseIndonesianNumber(streams);
    if (!Number.isSafeInteger(parsedStreams) || parsedStreams < 0) {
      setError('Jumlah streaming harus berupa angka bulat non-negatif.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const isAgg = streamingMode === 'aggregate';
      const actualPlatform = isAgg ? 'Agregat' : platform.trim();
      const cleanGross = streamGross.trim() ? parseIndonesianNumber(streamGross).toFixed(2) : null;
      const payload = {
        artist_id: streamArtist,
        platform: actualPlatform,
        is_aggregate: isAgg,
        period_start: streamStart,
        period_end: streamEnd,
        streams: parsedStreams,
        territory: territory.trim() || null,
        gross_revenue: cleanGross,
        currency: cleanGross ? streamCurrency : null,
        report_identifier: streamReportId.trim() || null,
        notes: streamNotes.trim() || null,
      };

      const response = streamingEditId
        ? await apiPut<StreamingRow>(`/api/admin/artist-finance/streaming/${streamingEditId}`, payload)
        : await apiPost<StreamingRow>('/api/admin/artist-finance/streaming', payload);

      if (!response.success) {
        throw new Error(response.error || 'Tidak dapat menyimpan laporan streaming.');
      }

      setNotice(
        streamingEditId
          ? 'Koreksi streaming tersimpan dan tercatat di audit log.'
          : isAgg
            ? 'Laporan streaming agregat berhasil disimpan ke database Neon.'
            : `Laporan streaming platform ${actualPlatform} berhasil disimpan. Anda dapat melanjutkan input platform berikutnya.`
      );
      // Keep artist and period so admin can quickly input next platform
      resetStreaming(true);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tidak dapat menyimpan laporan streaming.');
    } finally {
      setSaving(false);
    }
  };

  const editStreaming = (row: StreamingRow) => {
    setStreamingEditId(row.id);
    setStreamArtist(row.artist_id);
    const isAgg = row.platform.toLowerCase() === 'agregat' || row.platform.toLowerCase() === 'all';
    setStreamingMode(isAgg ? 'aggregate' : 'platform');
    setPlatform(row.platform);
    setStreamStart(row.period_start);
    setStreamEnd(row.period_end);
    setStreams(formatIdr(row.streams));
    setTerritory(row.territory || '');
    setStreamGross(row.gross_revenue == null ? '' : formatIdr(row.gross_revenue));
    setStreamCurrency(row.currency || 'IDR');
    setStreamReportId(row.report_identifier || '');
    setStreamNotes(row.notes || '');
    setTab('streaming');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetRoyalty = () => {
    setRoyaltyCorrectionId('');
    setRoyaltyStart(monthStart(todayMonth));
    setRoyaltyEnd(monthEnd(todayMonth));
    setRoyaltyStreams('');
    setGross('');
    setDeductionPercent('30');
    setDeductions('0');
    setNetRoyalty('');
    setRoyaltyCurrency('IDR');
    setRoyaltyStatus('draft');
    setRoyaltyReportId('');
    setRoyaltyNotes('');
    setCorrectionReason('');
  };

  // Live Automatic Deduction Calculation Handlers
  const handleGrossChange = (val: string) => {
    setGross(val);
    const g = parseIndonesianNumber(val);
    if (!val.trim()) {
      setDeductions('0');
      setNetRoyalty('');
      return;
    }
    const pct = Math.min(100, Math.max(0, Number(deductionPercent) || 0));
    const d = Math.round(g * (pct / 100) * 100) / 100;
    const n = Math.max(0, Math.round((g - d) * 100) / 100);
    setDeductions(d === 0 ? '0' : formatIdr(d));
    setNetRoyalty(formatIdr(n));
  };

  const handlePercentChange = (newPct: string | number) => {
    const numPct = typeof newPct === 'number' ? newPct : parseFloat(String(newPct));
    const clamped = isNaN(numPct) ? 0 : Math.min(100, Math.max(0, numPct));
    setDeductionPercent(String(clamped));
    const g = parseIndonesianNumber(gross);
    if (g > 0) {
      const d = Math.round(g * (clamped / 100) * 100) / 100;
      const n = Math.max(0, Math.round((g - d) * 100) / 100);
      setDeductions(d === 0 ? '0' : formatIdr(d));
      setNetRoyalty(formatIdr(n));
    }
  };

  const handleDeductionsChange = (val: string) => {
    setDeductions(val);
    const d = parseIndonesianNumber(val);
    const g = parseIndonesianNumber(gross);
    if (g > 0) {
      const n = Math.max(0, Math.round((g - d) * 100) / 100);
      const calculatedPct = Math.round(((d / g) * 100) * 100) / 100;
      setDeductionPercent(String(Math.min(100, Math.max(0, calculatedPct))));
      setNetRoyalty(formatIdr(n));
    }
  };

  const handleNetChange = (val: string) => {
    setNetRoyalty(val);
  };

  const saveRoyalty = async (event: FormEvent) => {
    event.preventDefault();
    if (!royaltyArtist && !royaltyCorrectionId) {
      setError('Pilih artis katalog terlebih dahulu.');
      return;
    }
    const g = gross.trim() ? parseIndonesianNumber(gross) : null;
    const d = parseIndonesianNumber(deductions);
    const n = parseIndonesianNumber(netRoyalty);

    if (g !== null && d > g) {
      setError('Jumlah potongan tidak boleh melebihi nominal awal (gross).');
      return;
    }
    if (n < 0) {
      setError('Nominal bersih royalti tidak boleh negatif.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const parsedStreams = royaltyStreams.trim() ? parseIndonesianNumber(royaltyStreams) : null;
      const payload = {
        ...(royaltyCorrectionId ? {} : { artist_id: royaltyArtist }),
        period_start: royaltyStart,
        period_end: royaltyEnd,
        streams: parsedStreams,
        gross_revenue: g !== null ? g.toFixed(2) : null,
        deductions: d.toFixed(2),
        net_royalty: n.toFixed(2),
        currency: royaltyCurrency,
        status: royaltyStatus,
        report_identifier: royaltyReportId.trim() || null,
        notes: royaltyNotes.trim() || null,
        ...(royaltyCorrectionId ? { reason: correctionReason.trim() } : {}),
      };

      const response = royaltyCorrectionId
        ? await apiPost<RoyaltyRow>(
            `/api/admin/artist-finance/royalties/${royaltyCorrectionId}/corrections`,
            payload
          )
        : await apiPost<RoyaltyRow>('/api/admin/artist-finance/royalties', payload);

      if (!response.success) {
        throw new Error(response.error || 'Tidak dapat menyimpan royalti.');
      }

      setNotice(
        royaltyCorrectionId
          ? 'Koreksi royalti tersimpan. Kredit lama dibalik dan revisi baru dicatat di ledger & audit log.'
          : royaltyStatus === 'finalized'
            ? 'Royalti difinalisasi dan kredit saldo dicatat ke financial ledger.'
            : 'Draft royalti tersimpan (belum menambah saldo artis).'
      );
      resetRoyalty();
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tidak dapat menyimpan royalti.');
    } finally {
      setSaving(false);
    }
  };

  const correctRoyalty = (row: RoyaltyRow) => {
    setRoyaltyCorrectionId(row.id);
    setRoyaltyArtist(row.artist_id);
    setRoyaltyStart(row.period_start);
    setRoyaltyEnd(row.period_end);
    setRoyaltyStreams(row.streams == null ? '' : formatIdr(row.streams));
    setGross(row.gross_revenue == null ? '' : formatIdr(row.gross_revenue));
    setDeductions(formatIdr(row.deductions));
    setNetRoyalty(formatIdr(row.net_royalty));
    if (row.gross_revenue && Number(row.gross_revenue) > 0) {
      const calculatedPct = Math.round((Number(row.deductions) / Number(row.gross_revenue)) * 100 * 100) / 100;
      setDeductionPercent(String(Math.min(100, Math.max(0, calculatedPct))));
    } else {
      setDeductionPercent('0');
    }
    setRoyaltyCurrency(row.currency || 'IDR');
    setRoyaltyStatus(row.status === 'draft' ? 'draft' : 'finalized');
    setRoyaltyReportId(row.report_identifier || '');
    setRoyaltyNotes(row.notes || '');
    setCorrectionReason('');
    setTab('royalty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currencyTotals = useMemo(
    () =>
      royaltyRows.reduce<Record<string, number>>((totals, row) => {
        if (row.status === 'superseded') return totals;
        totals[row.currency] = (totals[row.currency] || 0) + Number(row.net_royalty || 0);
        return totals;
      }, {}),
    [royaltyRows]
  );

  const totalStreamingSum = useMemo(
    () => streamingRows.reduce((sum, row) => sum + Number(row.streams || 0), 0),
    [streamingRows]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 font-sans text-white sm:p-8">
      {/* Header */}
      <header className="rounded-2xl border border-white/[0.06] bg-gradient-to-r from-[#17181e] to-[#121317] p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-[#FF6A3D]/20 p-2 text-[#FF6A3D]">
                <Coins className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">Streaming &amp; Royalty</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-[#9A9EAA]">
              Input manual agregat streaming dan royalti per artis. Data tersimpan langsung ke database Neon,
              terisolasi per akun artis, dan otomatis mencatat ledger kredit idempoten saat difinalisasi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-xs text-red-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="flex-1">{notice}</div>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-xs text-emerald-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav aria-label="Streaming and royalty tabs" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('streaming')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
            tab === 'streaming'
              ? 'bg-[#FF6A3D] text-white shadow-lg shadow-[#FF6A3D]/25'
              : 'border border-white/10 bg-white/[0.03] text-[#A7AAB5] hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Input Streaming
        </button>
        <button
          type="button"
          onClick={() => setTab('royalty')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
            tab === 'royalty'
              ? 'bg-[#FF6A3D] text-white shadow-lg shadow-[#FF6A3D]/25'
              : 'border border-white/10 bg-white/[0.03] text-[#A7AAB5] hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          <Coins className="h-4 w-4" />
          Input Royalty
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
            tab === 'history'
              ? 'bg-[#FF6A3D] text-white shadow-lg shadow-[#FF6A3D]/25'
              : 'border border-white/10 bg-white/[0.03] text-[#A7AAB5] hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          Riwayat &amp; Filter
        </button>

        <Link
          to="/admin/royalties"
          className="sm:ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-[#A7AAB5] hover:bg-white/[0.08] hover:text-white transition"
          title="Atur persentase aturan bagi hasil platform (Rule Setup)"
        >
          <Settings className="h-4 w-4 text-purple-400" />
          <span>Konfigurasi Aturan Royalti &rarr;</span>
        </Link>
      </nav>

      {/* ===================== TAB 1: INPUT STREAMING ===================== */}
      {tab === 'streaming' && (
        <section className="rounded-2xl border border-white/[0.07] bg-[#17181e] p-5 shadow-xl sm:p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                {streamingEditId ? 'Koreksi Laporan Streaming Agregat' : 'Input Streaming per Artis'}
              </h2>
              <p className="mt-1 text-xs text-[#8E92A0]">
                Input streaming dihitung pada tingkat artis dan periode. Data ini tidak digabung ke rincian per track
                sehingga mencegah double-counting.
              </p>
            </div>
            {streamingEditId && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                Mode Koreksi (Versi diperbarui)
              </span>
            )}
          </div>

          {artists.length === 0 && !loading ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-sm text-[#A7AAB5]">
              <Info className="mx-auto mb-2 h-6 w-6 text-[#8E92A0]" />
              Belum ada profil artis yang memiliki rilisan terdaftar di katalog.
              <p className="mt-1 text-xs text-[#6D7180]">
                Pastikan rilisan sudah disetujui atau terdaftar di katalog agar profil artis muncul otomatis.
              </p>
            </div>
          ) : (
            <form onSubmit={saveStreaming} className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#C5C7CF]">
                  Pilih Mode Input Streaming <span className="text-[#FF6A3D]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStreamingMode('aggregate');
                      setPlatform('Agregat');
                    }}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      streamingMode === 'aggregate'
                        ? 'border-[#FF6A3D] bg-[#FF6A3D]/15 text-white shadow-lg'
                        : 'border-white/10 bg-[#101116] text-[#A7AAB5] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span>Semua Platform / Agregat</span>
                      {streamingMode === 'aggregate' && <Check className="h-4 w-4 text-[#FF6A3D]" />}
                    </div>
                    <p className="mt-1 text-xs text-[#8E92A0]">
                      Memasukkan total streaming artis secara keseluruhan tanpa memilih platform.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStreamingMode('platform');
                      if (platform === 'Agregat') setPlatform('Spotify');
                    }}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      streamingMode === 'platform'
                        ? 'border-[#FF6A3D] bg-[#FF6A3D]/15 text-white shadow-lg'
                        : 'border-white/10 bg-[#101116] text-[#A7AAB5] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span>Per Platform</span>
                      {streamingMode === 'platform' && <Check className="h-4 w-4 text-[#FF6A3D]" />}
                    </div>
                    <p className="mt-1 text-xs text-[#8E92A0]">
                      Memasukkan streaming terpisah per platform (Spotify, Apple Music, YouTube, dll).
                    </p>
                  </button>
                </div>
              </div>

              <ArtistSearchSelect
                artists={artists}
                value={streamArtist}
                onChange={setStreamArtist}
                disabled={Boolean(streamingEditId)}
                label="Pilih Artis Katalog"
              />

              {streamingMode === 'aggregate' ? (
                <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                  <label className="font-medium text-[#C5C7CF]">Platform Streaming</label>
                  <div className="flex min-h-[48px] items-center rounded-xl border border-emerald-500/30 bg-[#101116] px-3.5 py-2.5 text-sm text-emerald-300">
                    <span className="font-semibold">Semua Platform (Agregat)</span>
                    <span className="ml-2 text-xs text-[#8E92A0]">— Tidak memerlukan nama platform</span>
                  </div>
                </div>
              ) : (
                <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                  <label className="font-medium text-[#C5C7CF]">
                    Platform Streaming <span className="text-[#FF6A3D]">*</span>
                  </label>
                  <input
                    required
                    list="streaming-platforms"
                    maxLength={80}
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                    placeholder="Spotify"
                  />
                  <datalist id="streaming-platforms">
                    <option value="Spotify" />
                    <option value="Apple Music" />
                    <option value="YouTube Music" />
                    <option value="Amazon Music" />
                    <option value="TikTok" />
                    <option value="Deezer" />
                    <option value="Tidal" />
                    <option value="Joox" />
                  </datalist>
                </div>
              )}

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Periode Mulai <span className="text-[#FF6A3D]">*</span>
                  </label>
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStreamStart(monthStart(todayMonth));
                        setStreamEnd(monthEnd(todayMonth));
                      }}
                      className="text-[#FF6A3D] hover:underline"
                    >
                      Bulan ini
                    </button>
                    <span className="text-[#555]">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const prev = getPreviousMonth();
                        setStreamStart(monthStart(prev));
                        setStreamEnd(monthEnd(prev));
                      }}
                      className="text-[#A7AAB5] hover:underline"
                    >
                      Bulan lalu
                    </button>
                  </div>
                </div>
                <input
                  required
                  type="date"
                  value={streamStart}
                  onChange={(e) => setStreamStart(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">
                  Periode Akhir <span className="text-[#FF6A3D]">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={streamEnd}
                  onChange={(e) => setStreamEnd(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Total Streaming <span className="text-[#FF6A3D]">*</span>
                  </label>
                  {streams && (
                    <span className="text-xs font-mono text-emerald-400">
                      Tersimpan: {formatIdr(parseIndonesianNumber(streams))}
                    </span>
                  )}
                </div>
                <input
                  required
                  type="text"
                  value={streams}
                  onChange={(e) => setStreams(e.target.value)}
                  placeholder="Contoh: 100.000 atau 100000"
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                />
                <span className="text-[11px] text-[#747987]">
                  Dapat diketik dengan titik (100.000) atau tanpa titik (100000).
                </span>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">Wilayah / Negara (Opsional)</label>
                <input
                  maxLength={80}
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                  placeholder="ID / US / Global"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">Pendapatan Platform (Opsional)</label>
                  {streamGross && (
                    <span className="text-xs font-mono text-emerald-400">
                      Format: {formatIdr(parseIndonesianNumber(streamGross))}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={streamGross}
                  onChange={(e) => setStreamGross(e.target.value)}
                  placeholder="Contoh: 1.500.000 atau 1500000"
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">
                  Mata Uang
                  {streamGross && <span className="text-[#FF8C69]"> (Wajib jika pendapatan diisi)</span>}
                </label>
                <select
                  required={Boolean(streamGross)}
                  value={streamCurrency}
                  onChange={(e) => setStreamCurrency(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                >
                  {['USD', 'IDR', 'EUR', 'GBP', 'JPY', 'SGD', 'MYR', 'THB', 'PHP', 'AUD', 'CAD', 'INR', 'KRW', 'CNY', 'BRL', 'MXN', 'ZAR', 'AED', 'SAR'].map(
                    (code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">Identitas Laporan / Referensi (Opsional)</label>
                <input
                  maxLength={160}
                  value={streamReportId}
                  onChange={(e) => setStreamReportId(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                  placeholder="Contoh: SPOT-2026-08-BATCH"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF] md:col-span-2">
                <label className="font-medium text-[#C5C7CF]">Catatan Admin (Opsional)</label>
                <textarea
                  maxLength={2000}
                  value={streamNotes}
                  onChange={(e) => setStreamNotes(e.target.value)}
                  rows={2}
                  className="rounded-xl border border-white/10 bg-[#101116] p-3 text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                  placeholder="Catatan tambahan mengenai laporan sumber atau verifikasi"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving || loading || artists.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-[#FF6A3D] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#FF6A3D]/25 transition hover:bg-[#ff7a52] disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : streamingEditId ? 'Simpan Koreksi Streaming' : 'Simpan Laporan Streaming'}
                </button>
                {streamingEditId && (
                  <button
                    type="button"
                    onClick={() => resetStreaming()}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white transition hover:bg-white/[0.08]"
                  >
                    Batal Koreksi
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      {/* ===================== TAB 2: INPUT ROYALTY ===================== */}
      {tab === 'royalty' && (
        <section className="rounded-2xl border border-white/[0.07] bg-[#17181e] p-5 shadow-xl sm:p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                {royaltyCorrectionId ? 'Koreksi Royalti Artis' : 'Input Royalti Manual per Artis'}
              </h2>
              <p className="mt-1 text-xs text-[#9A9EAA]">
                Status <strong className="text-emerald-400">Finalized</strong> langsung mencatat kredit saldo ke
                financial ledger artis. Status <strong className="text-amber-400">Draft</strong> belum mempengaruhi saldo.
              </p>
            </div>
            {royaltyCorrectionId && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                Mode Koreksi (Kredit lama dibalik secara atomik)
              </span>
            )}
          </div>

          {artists.length === 0 && !loading ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-sm text-[#A7AAB5]">
              Belum ada artis katalog yang memiliki rilisan.
            </div>
          ) : (
            <form onSubmit={saveRoyalty} className="grid gap-5 md:grid-cols-2">
              <ArtistSearchSelect
                artists={artists}
                value={royaltyArtist}
                onChange={setRoyaltyArtist}
                disabled={Boolean(royaltyCorrectionId)}
                label="Pilih Artis Katalog"
              />

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">Total Streaming Terkait (Otomatis dari Database)</label>
                <div className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] p-3">
                  <div className="flex items-center justify-between font-mono font-bold text-white text-base">
                    <span>{formatIdr(streamingSummaryForRoyalty.total)} streams</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-normal text-[#A7AAB5]">
                      {streamingSummaryForRoyalty.hasAggregate ? 'Data Agregat' : 'Gabungan Platform'}
                    </span>
                  </div>
                  {streamingSummaryForRoyalty.platforms.length > 0 && !streamingSummaryForRoyalty.hasAggregate && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[#8E92A0]">
                      {streamingSummaryForRoyalty.platforms.map((p) => (
                        <span key={p.platform} className="rounded bg-white/[0.05] px-2 py-0.5">
                          {p.platform}: {formatIdr(p.streams)}
                        </span>
                      ))}
                    </div>
                  )}
                  {streamingSummaryForRoyalty.isMixed && (
                    <div className="mt-2 text-xs text-amber-400/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      Terdeteksi data agregat dan detail platform. Sesuai aturan anti-duplikasi, total hanya menghitung data agregat.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Periode Mulai <span className="text-[#FF6A3D]">*</span>
                  </label>
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setRoyaltyStart(monthStart(todayMonth));
                        setRoyaltyEnd(monthEnd(todayMonth));
                      }}
                      className="text-[#FF6A3D] hover:underline"
                    >
                      Bulan ini
                    </button>
                    <span className="text-[#555]">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const prev = getPreviousMonth();
                        setRoyaltyStart(monthStart(prev));
                        setRoyaltyEnd(monthEnd(prev));
                      }}
                      className="text-[#A7AAB5] hover:underline"
                    >
                      Bulan lalu
                    </button>
                  </div>
                </div>
                <input
                  required
                  type="date"
                  value={royaltyStart}
                  onChange={(e) => setRoyaltyStart(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">
                  Periode Akhir <span className="text-[#FF6A3D]">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={royaltyEnd}
                  onChange={(e) => setRoyaltyEnd(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">Jumlah Streaming Terkait (Otomatis)</label>
                  {royaltyStreams && (
                    <span className="text-xs font-mono text-emerald-400">
                      {formatIdr(parseIndonesianNumber(royaltyStreams))} streams
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={royaltyStreams}
                  onChange={(e) => setRoyaltyStreams(e.target.value)}
                  placeholder="Total streaming terkait"
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Nominal Awal / Pendapatan Bruto (Opsional)
                  </label>
                  {gross && (
                    <span className="text-xs font-mono text-emerald-400">
                      Format: {formatIdr(parseIndonesianNumber(gross))}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={gross}
                  onChange={(e) => handleGrossChange(e.target.value)}
                  placeholder="Contoh: 100.000 atau 1.500.000"
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                />
                <span className="text-[11px] text-[#747987]">
                  Masukkan nominal awal, potongan akan dihitung otomatis secara live.
                </span>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Persentase Potongan (0% - 100%)
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-400">{deductionPercent}%</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={deductionPercent}
                    onChange={(e) => handlePercentChange(e.target.value)}
                    className="min-h-[48px] w-28 rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white focus:border-[#FF6A3D] focus:outline-none"
                  />
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {[0, 10, 15, 20, 30, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePercentChange(pct)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          Number(deductionPercent) === pct
                            ? 'bg-[#FF6A3D] text-white'
                            : 'border border-white/10 bg-white/[0.04] text-[#A7AAB5] hover:text-white'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Jumlah Potongan <span className="text-[#FF6A3D]">*</span>
                  </label>
                  {deductions && (
                    <span className="text-xs font-mono text-red-400">
                      - {formatIdr(parseIndonesianNumber(deductions))}
                    </span>
                  )}
                </div>
                <input
                  required
                  type="text"
                  value={deductions}
                  onChange={(e) => handleDeductionsChange(e.target.value)}
                  placeholder="0"
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#C5C7CF]">
                    Royalti Bersih Artis <span className="text-[#FF6A3D]">*</span>
                  </label>
                  {netRoyalty && (
                    <span className="text-xs font-mono text-emerald-400">
                      Bersih: {formatIdr(parseIndonesianNumber(netRoyalty))}
                    </span>
                  )}
                </div>
                <input
                  required
                  type="text"
                  value={netRoyalty}
                  onChange={(e) => handleNetChange(e.target.value)}
                  placeholder="Contoh: 70.000 atau 1.350.000"
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 font-mono text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>

              {/* LIVE DEDUCTION & CALCULATION SUMMARY CARD */}
              <div className="rounded-2xl border border-white/10 bg-[#101116] p-4 md:col-span-2">
                <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2 text-xs font-bold uppercase tracking-wider text-[#FF6A3D]">
                  <Calculator className="h-4 w-4" />
                  Rincian Perhitungan Potongan Otomatis (Live)
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-[#8E92A0]">Nominal Awal</span>
                    <div className="mt-1 font-mono font-bold text-white text-base">
                      {gross ? `${royaltyCurrency} ${formatIdr(parseIndonesianNumber(gross))}` : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-[#8E92A0]">Persentase Potongan</span>
                    <div className="mt-1 font-mono font-bold text-amber-400 text-base">
                      {deductionPercent}%
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-[#8E92A0]">Jumlah Potongan</span>
                    <div className="mt-1 font-mono font-bold text-red-400 text-base">
                      - {royaltyCurrency} {formatIdr(parseIndonesianNumber(deductions))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-[#8E92A0]">Saldo Bersih Artis</span>
                    <div className="mt-1 font-mono font-bold text-emerald-400 text-base">
                      {royaltyCurrency} {formatIdr(parseIndonesianNumber(netRoyalty))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">
                  Mata Uang <span className="text-[#FF6A3D]">*</span>
                </label>
                <select
                  required
                  value={royaltyCurrency}
                  onChange={(e) => setRoyaltyCurrency(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                >
                  {['USD', 'IDR', 'EUR', 'GBP', 'JPY', 'SGD', 'MYR', 'THB', 'PHP', 'AUD', 'CAD', 'INR', 'KRW', 'CNY', 'BRL', 'MXN', 'ZAR', 'AED', 'SAR'].map(
                    (code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">
                  Status Pemrosesan <span className="text-[#FF6A3D]">*</span>
                </label>
                <select
                  required
                  value={royaltyStatus}
                  onChange={(e) => setRoyaltyStatus(e.target.value as 'draft' | 'finalized')}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white focus:border-[#FF6A3D] focus:outline-none"
                >
                  <option value="draft">Draft — belum masuk ke saldo artis</option>
                  <option value="finalized">Finalized — langsung catat kredit saldo</option>
                </select>
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF]">
                <label className="font-medium text-[#C5C7CF]">Identitas Laporan / Referensi (Opsional)</label>
                <input
                  maxLength={160}
                  value={royaltyReportId}
                  onChange={(e) => setRoyaltyReportId(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-white/10 bg-[#101116] px-3.5 py-2.5 text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                  placeholder="Misal: STMT-2026-08-01"
                />
              </div>

              <div className="grid gap-1.5 text-sm text-[#C5C7CF] md:col-span-2">
                <label className="font-medium text-[#C5C7CF]">Catatan Admin (Opsional)</label>
                <textarea
                  maxLength={2000}
                  value={royaltyNotes}
                  onChange={(e) => setRoyaltyNotes(e.target.value)}
                  rows={2}
                  className="rounded-xl border border-white/10 bg-[#101116] p-3 text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                  placeholder="Catatan mengenai laporan atau rincian pemrosesan"
                />
              </div>

              {royaltyCorrectionId && (
                <div className="grid gap-1.5 text-sm text-[#C5C7CF] md:col-span-2">
                  <label className="flex items-center gap-1 font-semibold text-amber-300">
                    Alasan Koreksi (Wajib untuk Audit Trail) <span className="text-[#FF6A3D]">*</span>
                  </label>
                  <textarea
                    required
                    minLength={4}
                    maxLength={500}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    rows={2}
                    className="rounded-xl border border-amber-500/30 bg-[#101116] p-3 text-white placeholder-[#6D7180] focus:border-amber-400 focus:outline-none"
                    placeholder="Jelaskan alasan koreksi data royalti ini (dicatat ke log audit)"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving || loading || artists.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-[#FF6A3D] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#FF6A3D]/25 transition hover:bg-[#ff7a52] disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : royaltyCorrectionId ? 'Simpan Koreksi Royalti' : 'Simpan Royalti'}
                </button>
                {royaltyCorrectionId && (
                  <button
                    type="button"
                    onClick={resetRoyalty}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white transition hover:bg-white/[0.08]"
                  >
                    Batal Koreksi
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      {/* ===================== TAB 3: RIWAYAT & FILTER ===================== */}
      {tab === 'history' && (
        <section className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.06] bg-[#17181e] p-5">
              <div className="text-xs uppercase tracking-wider text-[#8E92A0]">Total Laporan Streaming</div>
              <div className="mt-2 text-2xl font-bold text-white">{streamingRows.length}</div>
              <div className="mt-1 text-xs text-[#6D7180]">{totalStreamingSum.toLocaleString()} total streams</div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#17181e] p-5">
              <div className="text-xs uppercase tracking-wider text-[#8E92A0]">Total Entri Royalti</div>
              <div className="mt-2 text-2xl font-bold text-white">
                {royaltyRows.filter((r) => r.status !== 'superseded').length}
              </div>
              <div className="mt-1 text-xs text-[#6D7180]">
                {royaltyRows.filter((r) => r.status === 'finalized').length} finalized,{' '}
                {royaltyRows.filter((r) => r.status === 'draft').length} draft
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#17181e] p-5 sm:col-span-2">
              <div className="text-xs uppercase tracking-wider text-[#8E92A0]">Total Royalti per Mata Uang</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {Object.keys(currencyTotals).length === 0 ? (
                  <span className="text-sm text-[#6D7180]">Belum ada royalti aktif</span>
                ) : (
                  Object.entries(currencyTotals).map(([cur, total]) => (
                    <div
                      key={cur}
                      className="rounded-xl border border-white/10 bg-[#101116] px-3.5 py-1.5 font-mono text-sm"
                    >
                      <span className="text-[#FF6A3D] font-bold">{cur}</span>{' '}
                      <span className="text-white">
                        {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-1 text-[11px] text-[#6D7180]">
                Setiap mata uang disajikan terpisah tanpa konversi sembarangan.
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#17181e] p-5 shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Filter className="h-4 w-4 text-[#FF6A3D]" />
              Filter Riwayat
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1 text-xs text-[#C5C7CF]">
                <span>Artis</span>
                <select
                  value={filterArtist}
                  onChange={(e) => setFilterArtist(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#101116] p-2.5 text-sm text-white focus:border-[#FF6A3D] focus:outline-none"
                >
                  <option value="">Semua Artis ({artists.length})</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.artist_name} {a.account_artist_id ? `(${a.account_artist_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1 text-xs text-[#C5C7CF]">
                <span>Platform Streaming</span>
                <input
                  list="streaming-platforms"
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#101116] p-2.5 text-sm text-white placeholder-[#6D7180] focus:border-[#FF6A3D] focus:outline-none"
                  placeholder="Semua Platform"
                />
              </div>

              <div className="grid gap-1 text-xs text-[#C5C7CF]">
                <span>Periode Bulan</span>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#101116] p-2.5 text-sm text-white focus:border-[#FF6A3D] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-[#8E92A0]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="rounded-lg bg-[#FF6A3D] px-3.5 py-1.5 font-semibold text-white transition hover:bg-[#ff7a52]"
                >
                  Terapkan Filter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterArtist('');
                    setFilterPlatform('');
                    setFilterMonth('');
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white transition hover:bg-white/[0.08]"
                >
                  Reset Filter
                </button>
              </div>
              <div>
                Menampilkan {streamingRows.length} laporan streaming dan {royaltyRows.length} entri royalti
              </div>
            </div>
          </div>

          {/* Table 1: Streaming Aggregates */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#17181e] shadow-lg">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
              <div>
                <h3 className="text-base font-bold text-white">Riwayat Streaming Agregat Artis</h3>
                <p className="mt-0.5 text-xs text-[#8E92A0]">
                  Laporan sumber pada tingkat artis/periode. Terpisah dari rincian track.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#A7AAB5]">
                {streamingRows.length} record
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-[#A7AAB5]">Memuat data streaming…</div>
            ) : streamingRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#A7AAB5]">
                Belum ada data streaming yang sesuai dengan filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-[#7E8290]">
                      <th className="p-4">Artis &amp; Akun</th>
                      <th className="p-4">Platform &amp; Wilayah</th>
                      <th className="p-4">Periode</th>
                      <th className="p-4 text-right">Total Streams</th>
                      <th className="p-4">Pendapatan Platform</th>
                      <th className="p-4">Sumber / Versi</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streamingRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-white/[0.04] transition hover:bg-white/[0.02] last:border-0"
                      >
                        <td className="p-4">
                          <div className="font-semibold text-white">{row.artist_name}</div>
                          <div className="text-xs text-[#747987]">
                            {row.account_artist_id ? `ID: ${row.account_artist_id} · ` : ''}
                            {row.owner_email}
                          </div>
                        </td>
                        <td className="p-4">
                          {row.platform.toLowerCase() === 'agregat' || row.platform.toLowerCase() === 'all' ? (
                            <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                              Agregat (Semua Platform)
                            </span>
                          ) : (
                            <span className="font-medium text-white">{row.platform}</span>
                          )}
                          {row.territory && (
                            <span className="ml-1.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-[#A7AAB5]">
                              {row.territory}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-mono text-xs text-[#A7AAB5]">
                          {row.period_start} s/d {row.period_end}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-white">
                          {formatIdr(row.streams)}
                        </td>
                        <td className="p-4 text-[#A7AAB5]">
                          {row.gross_revenue == null
                            ? '—'
                            : `${row.currency} ${formatIdr(row.gross_revenue)}`}
                        </td>
                        <td className="p-4 text-xs text-[#747987]">
                          <span className="capitalize">{row.source}</span> · v{row.version}
                          {row.report_identifier && (
                            <div className="truncate text-[11px] text-[#5A5E6D]">{row.report_identifier}</div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => editStreaming(row)}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white transition hover:border-[#FF6A3D] hover:bg-[#FF6A3D]/10"
                          >
                            Koreksi
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Table 2: Manual Royalties */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#17181e] shadow-lg">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
              <div>
                <h3 className="text-base font-bold text-white">Riwayat Royalti Manual Artis</h3>
                <p className="mt-0.5 text-xs text-[#8E92A0]">
                  Entri royalti manual dan catatan ledger keuangan artis.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#A7AAB5]">
                {royaltyRows.length} record
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-[#A7AAB5]">Memuat data royalti…</div>
            ) : royaltyRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#A7AAB5]">
                Belum ada data royalti yang sesuai dengan filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-[#7E8290]">
                      <th className="p-4">Artis &amp; Akun</th>
                      <th className="p-4">Periode</th>
                      <th className="p-4 text-right">Streams Terkait</th>
                      <th className="p-4">Nominal Awal &amp; Potongan</th>
                      <th className="p-4 text-right">Royalti Bersih</th>
                      <th className="p-4">Status &amp; Revisi</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {royaltyRows.map((row) => {
                      const grossNum = row.gross_revenue == null ? 0 : Number(row.gross_revenue);
                      const dedNum = Number(row.deductions || 0);
                      const pct = grossNum > 0 ? Math.round((dedNum / grossNum) * 100) : 0;
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-white/[0.04] transition hover:bg-white/[0.02] last:border-0 ${
                            row.status === 'superseded' ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="font-semibold text-white">{row.artist_name}</div>
                            <div className="text-xs text-[#747987]">
                              {row.account_artist_id ? `ID: ${row.account_artist_id} · ` : ''}
                              {row.owner_email}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-mono text-xs text-[#A7AAB5]">
                              {row.period_start} s/d {row.period_end}
                            </div>
                            {row.report_identifier && (
                              <div className="text-[11px] text-[#5A5E6D]">{row.report_identifier}</div>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono text-white">
                            {row.streams == null ? '—' : formatIdr(row.streams)}
                          </td>
                          <td className="p-4 text-xs text-[#A7AAB5]">
                            <div>
                              Awal:{' '}
                              {row.gross_revenue == null
                                ? '—'
                                : `${row.currency} ${formatIdr(row.gross_revenue)}`}
                            </div>
                            <div className="text-[#8E92A0]">
                              Potongan: {formatIdr(row.deductions)} {row.currency}
                              {grossNum > 0 && <span className="ml-1 text-amber-400 font-semibold">({pct}%)</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-white">
                            <span className="text-base text-emerald-400">{formatIdr(row.net_royalty)}</span>{' '}
                            <span className="text-[#FF6A3D] text-xs">{row.currency}</span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                row.status === 'finalized'
                                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                  : row.status === 'draft'
                                    ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                                    : 'border border-white/10 bg-white/[0.05] text-[#8E92A0] line-through'
                              }`}
                            >
                              {row.status}
                            </span>
                            <div className="mt-1 text-[11px] text-[#747987]">
                              Rev v{row.revision}
                              {row.supersedes_id && ' · hasil koreksi'}
                            </div>
                          </td>
                        <td className="p-4 text-center">
                          {row.status !== 'superseded' && (
                            <button
                              type="button"
                              onClick={() => correctRoyalty(row)}
                              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white transition hover:border-[#FF6A3D] hover:bg-[#FF6A3D]/10"
                            >
                              Koreksi
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
