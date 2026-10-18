import { FormEvent, useCallback, useEffect, useState } from 'react';
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
      setNotice('Rule saved. It applies only to matching reports and dates.');
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
      setNotice(`Royalty batch ${response.data?.batchId || ''} completed.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Royalty report could not be processed.');
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Royalties Management</h1>
        <p className="text-gray-500">Configure an explicit artist share before processing a validated streaming report. No default rate or currency conversion is applied.</p>
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">{notice}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-xl font-semibold">Configure royalty rule</h2>
        {artists.length === 0 ? <p className="text-gray-500">No artist accounts are available to configure.</p> :
          <form onSubmit={createRule} className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm">Artist
              <select required value={artistId} onChange={(event) => setArtistId(event.target.value)} className="rounded-lg border p-2">
                {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.artist_name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Platform (must match report)
              <input required maxLength={80} value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="spotify" className="rounded-lg border p-2" />
            </label>
            <label className="grid gap-1 text-sm">Artist share (%)
              <input required type="number" min="0.0001" max="100" step="0.0001" value={share} onChange={(event) => setShare(event.target.value)} className="rounded-lg border p-2" />
            </label>
            <label className="grid gap-1 text-sm">Revenue basis
              <select value={basis} onChange={(event) => setBasis(event.target.value as 'gross' | 'net')} className="rounded-lg border p-2">
                <option value="net">Net revenue</option><option value="gross">Gross revenue</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">Effective from
              <input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="rounded-lg border p-2" />
            </label>
            <label className="grid gap-1 text-sm">Effective until (optional)
              <input type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} className="rounded-lg border p-2" />
            </label>
            <div className="md:col-span-3"><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save rule'}</button></div>
          </form>}
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b p-6"><h2 className="text-xl font-semibold">Configured rules</h2></div>
        {loading ? <div className="p-6 text-gray-500">Loading rules…</div> : rules.length === 0 ? <div className="p-6 text-gray-500">No rules configured. Royalty processing remains unavailable until a valid share rule is added.</div> :
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b text-gray-500"><th className="p-4">Artist</th><th className="p-4">Platform</th><th className="p-4">Share</th><th className="p-4">Basis</th><th className="p-4">Currency</th><th className="p-4">Effective dates</th></tr></thead>
            <tbody>{rules.map((rule) => <tr key={rule.id} className="border-b last:border-0"><td className="p-4">{rule.artist_name}</td><td className="p-4">{rule.platform}</td><td className="p-4">{rule.share_percent}%</td><td className="p-4">{rule.revenue_basis}</td><td className="p-4">{rule.currency}</td><td className="p-4">{rule.effective_from} – {rule.effective_until || 'ongoing'}</td></tr>)}</tbody>
          </table>}
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b p-6"><h2 className="text-xl font-semibold">Streaming reports</h2><p className="mt-1 text-sm text-gray-500">Only completed reports with zero rejected, unmatched, or duplicate rows can be processed.</p></div>
        {loading ? <div className="p-6 text-gray-500">Loading reports…</div> : imports.length === 0 ? <div className="p-6 text-gray-500">No report imports are available.</div> :
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead><tr className="border-b text-gray-500"><th className="p-4">Source / file</th><th className="p-4">Status</th><th className="p-4">Rows</th><th className="p-4">Imported</th><th className="p-4">Action</th></tr></thead>
            <tbody>{imports.map((report) => <tr key={report.id} className="border-b last:border-0"><td className="p-4">{report.source}<div className="text-xs text-gray-500">{report.filename}</div></td><td className="p-4">{report.status}</td><td className="p-4">{report.valid_rows} accepted / {report.invalid_rows} rejected</td><td className="p-4">{new Date(report.created_at).toLocaleDateString()}</td><td className="p-4">{report.status === 'completed' && <button disabled={processingId === report.id || report.invalid_rows > 0 || rules.length === 0} onClick={() => void processReport(report)} className="rounded-lg bg-emerald-600 px-3 py-2 text-white disabled:opacity-40">{processingId === report.id ? 'Processing…' : 'Process royalties'}</button>}</td></tr>)}</tbody>
          </table>}
      </section>
    </div>
  );
}
