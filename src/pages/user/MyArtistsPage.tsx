import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader, Users } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { getUserArtists, deleteArtist, createArtist } from '@services/artistService';
import type { Artist } from '@/types';

export default function MyArtistsPage() {
  const { user } = useAuth();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ artist_name: '', bio: '', genre: '', country: '' });

  useEffect(() => {
    const loadArtists = async () => {
      try {
        setLoading(true);
        if (!user) {
          return;
        }

        const { data, error: err } = await getUserArtists(user.id);
        if (err) throw err;
        setArtists(data || []);
      } catch (err) {
        setError('Failed to load artists');
        console.error('Artists error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadArtists();
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus profil artis ini?')) return;
    try {
      const { error: err } = await deleteArtist(id);
      if (err) throw err;
      setArtists(artists.filter(a => a.id !== id));
    } catch (err) {
      setError('Gagal menghapus artis');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Memuat daftar artis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white font-sans w-full max-w-7xl mx-auto pb-12 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121217] border border-white/[0.08] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Artis &amp; Band Saya</h1>
          </div>
          <p className="text-xs text-gray-400">
            Kelola profil artis utama dan musisi yang terdaftar untuk distribusi rilis lagu Anda.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-3 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] text-white text-xs font-bold transition-all shadow-[0_8px_20px_rgba(79,103,255,0.4)] hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Artis Baru</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4 animate-scaleUp">
          <h2 className="text-base font-bold text-white">Buat Profil Artis Baru</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (!user) throw new Error('Sesi login tidak valid. Silakan masuk kembali.');
                const { error: createError } = await createArtist({
                  owner_id: user.id,
                  artist_name: formData.artist_name,
                  bio: formData.bio,
                  genre: formData.genre,
                  country: formData.country,
                });
                if (createError) throw createError;
                const { data, error: loadError } = await getUserArtists(user.id);
                if (loadError) throw loadError;
                if (data) setArtists(data);
                setError('');
                setShowForm(false);
                setFormData({ artist_name: '', bio: '', genre: '', country: '' });
              } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : 'Gagal menyimpan artis.');
              }
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 font-bold mb-1">Nama Artis / Band *</label>
                <input
                  type="text"
                  placeholder="Contoh: Senja Harmony"
                  value={formData.artist_name}
                  onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1">Genre Utama</label>
                <input
                  type="text"
                  placeholder="Contoh: Indie Pop, Rock"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">Bio Singkat</label>
              <textarea
                placeholder="Tuliskan biografi singkat artis..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-[#121218] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 min-h-20"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#4F67FF] text-white font-bold hover:bg-[#435BFF] transition-all">
                Simpan Profil Artis
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] text-gray-300 hover:text-white"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {artists.length === 0 ? (
        <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-12 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">Belum Ada Profil Artis</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Buat profil artis pertama Anda untuk mulai mendistribusikan karya musik ke seluruh platform digital.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#4F67FF] text-white text-xs font-bold hover:scale-105 transition-all"
          >
            Buat Profil Artis
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {artists.map((artist) => (
            <div key={artist.id} className="bg-[#14141B] border border-white/[0.08] hover:border-white/[0.18] rounded-3xl p-5 shadow-lg transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
                  {artist.artist_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(artist.id)}
                    className="p-2 rounded-xl bg-white/[0.03] hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-base font-extrabold text-white truncate">{artist.artist_name}</h3>
              {artist.genre && <p className="text-xs text-indigo-400 font-medium mt-0.5">{artist.genre}</p>}
              {artist.bio && <p className="text-xs text-gray-400 line-clamp-2 mt-2">{artist.bio}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
