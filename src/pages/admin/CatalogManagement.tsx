import { useEffect, useMemo, useState } from 'react';
import { Music, Search, Play, Disc3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CatalogItem } from '@services/distributionSyncService';
import { apiGet } from '@lib/api/client';

type ApiPage<T> = { data?: T[]; total?: number };

export default function CatalogManagement() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [releasesResponse, artistsResponse] = await Promise.all([
          apiGet<ApiPage<any>>('/api/releases?limit=100'),
          apiGet<ApiPage<any>>('/api/artists?limit=100'),
        ]);
        const releases = releasesResponse.data?.data || [];
        const artists = artistsResponse.data?.data || [];
        const artistById = new Map<string, string>(artists.map((artist: any) => [artist.id, artist.artist_name || '']));
        const trackLists = await Promise.all(releases.map(async (release: any) => {
          const result = await apiGet<ApiPage<any>>(`/api/tracks?release_id=${encodeURIComponent(release.id)}&limit=100`);
          return (result.data?.data || []).map((track: any): CatalogItem => {
            const seconds = Number(track.duration || 0);
            return {
              id: track.id,
              title: track.title,
              artist: artistById.get(release.primary_artist_id) || '',
              album: release.title,
              genre: release.genre || track.genre || '',
              duration_seconds: seconds,
              duration: seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '',
              cover_url: release.artwork_url || '',
              audio_url: track.audio_url,
              isrc: track.isrc || '',
              release_date: release.release_date || '',
              added_by: 'user',
              created_at: track.created_at,
            };
          });
        }));
        if (active) setCatalog(trackLists.flat());
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat katalog.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const playSong = (track: CatalogItem) => {
    window.dispatchEvent(new CustomEvent('groovvy-play-track', {
      detail: { title: track.title, artist: track.artist, album: track.album, artwork: track.cover_url, duration: track.duration_seconds },
    }));
  };

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return catalog.filter((track) => !query || [track.title, track.artist, track.isrc].some((value) => value.toLowerCase().includes(query)));
  }, [catalog, searchQuery]);

  return (
    <div className="space-y-6 text-white font-sans max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Music className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black tracking-tight">Manajemen Katalog Musik</h1>
          </div>
          <p className="text-xs text-gray-400">Katalog hanya menampilkan track dan rilis yang tersimpan di database.</p>
        </div>
        <button onClick={() => navigate('/admin/releases')} className="px-5 py-3 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] text-white text-xs font-bold transition-all flex items-center gap-2">
          <Disc3 className="w-4 h-4" /> Review Rilis
        </button>
      </div>

      {error && <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{error}</div>}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-gray-400">Total Katalog: <strong className="text-white">{catalog.length} Lagu</strong></div>
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Cari lagu, artis, atau ISRC..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full bg-[#14141B] text-white text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-white/[0.07] focus:outline-none focus:border-indigo-500/50" />
        </div>
      </div>
      <div className="bg-[#14141B] border border-white/[0.06] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-white/[0.08] text-gray-400 uppercase tracking-wider text-[11px] bg-white/[0.02]"><th className="py-4 px-5">Track &amp; Artis</th><th className="py-4 px-4">Album / Rilis</th><th className="py-4 px-4">Genre</th><th className="py-4 px-4">Durasi</th><th className="py-4 px-4">ISRC</th><th className="py-4 px-5 text-right">Aksi</th></tr></thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((item) => <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                <td className="py-3.5 px-5"><div className="flex items-center gap-3.5"><div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0"><img src={item.cover_url || '/images/placeholder-cover.png'} alt="" className="w-full h-full object-cover" /></div><div><p className="font-extrabold text-white text-sm">{item.title}</p><p className="text-gray-400 mt-0.5">{item.artist || '—'}</p></div></div></td>
                <td className="py-3.5 px-4 text-gray-300 font-medium">{item.album || '—'}</td><td className="py-3.5 px-4 text-gray-300">{item.genre || '—'}</td><td className="py-3.5 px-4 text-gray-400 font-mono">{item.duration || '—'}</td><td className="py-3.5 px-4 text-gray-400 font-mono text-[11px]">{item.isrc || '—'}</td>
                <td className="py-3.5 px-5 text-right"><button onClick={() => playSong(item)} className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.15] text-white transition-colors" title="Putar Lagu"><Play className="w-3.5 h-3.5 fill-current" /></button></td>
              </tr>)}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">{error ? 'Katalog tidak dapat dimuat.' : 'Belum ada track di database.'}</td></tr>}
              {loading && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Memuat katalog...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
