import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, Music, AlertCircle, ChevronRight } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { getArtistsList, getArtistCatalog } from '@services/adminService';

interface Artist {
  id: string;
  artist_name: string;
  genre?: string;
  country?: string;
  created_at: string;
  owner?: { full_name: string };
  releaseCount: number;
}

export default function ArtistsManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    const loadArtists = async () => {
      try {
        setLoading(true);
        setError('');

        const user = await getCurrentUser();
        if (!user) {
          return;
        }

        const offset = page * pageSize;
        const { data, total: totalArtists, error: artistsError } = await getArtistsList(
          pageSize,
          offset
        );

        if (artistsError) throw artistsError;

        setArtists(data || []);
        setTotal(totalArtists || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load artists';
        setError(message);
        console.error('Artists management error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadArtists();
  }, [navigate, page]);

  const handleViewCatalog = async (artistId: string) => {
    try {
      setCatalogLoading(true);
      const { data, error: catalogError } = await getArtistCatalog(artistId);
      if (catalogError) throw catalogError;
      setSelectedArtist(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load catalog';
      setError(message);
    } finally {
      setCatalogLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading artists...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);
  const filteredArtists = artists.filter(a =>
    a.artist_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Artists Management</h1>
        <p className="text-gray-600">Manage artists and view their catalogs</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Artists List */}
        <div className="lg:col-span-2">
          {/* Search Bar */}
          <div className="card p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search artists..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Artists List */}
          <div className="card">
            {filteredArtists.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredArtists.map(artist => (
                  <div
                    key={artist.id}
                    className="p-4 hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => handleViewCatalog(artist.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{artist.artist_name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {artist.genre && `${artist.genre} •`} {artist.country || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {artist.releaseCount} release{artist.releaseCount !== 1 ? 's' : ''} •{' '}
                          {artist.owner?.full_name}
                        </p>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleViewCatalog(artist.id);
                        }}
                        disabled={catalogLoading}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No artists found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-gray-600 text-sm">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of{' '}
                {total} artists
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Catalog Detail */}
        <div className="lg:col-span-1">
          {catalogLoading ? (
            <div className="card p-8 text-center">
              <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading catalog...</p>
            </div>
          ) : selectedArtist ? (
            <div className="space-y-4">
              {/* Artist Info */}
              <div className="card p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-2">
                  {selectedArtist.artist?.artist_name}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {selectedArtist.artist?.genre || 'No genre'} • {selectedArtist.artist?.country || 'Unknown'}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Releases</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {selectedArtist.totalReleases}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Tracks</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedArtist.totalTracks}
                    </p>
                  </div>
                </div>
              </div>

              {/* Releases */}
              <div className="card p-6">
                <h4 className="font-bold text-gray-900 mb-3">Releases ({selectedArtist.releases?.length || 0})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedArtist.releases && selectedArtist.releases.length > 0 ? (
                    selectedArtist.releases.map((release: any) => (
                      <div key={release.id} className="p-2 bg-gray-50 rounded-lg text-sm">
                        <p className="font-medium text-gray-900 truncate">{release.title}</p>
                        <p className="text-xs text-gray-600">
                          {release.release_type} • {release.tracks?.length || 0} tracks
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-white ${
                            release.status === 'live'
                              ? 'bg-green-600'
                              : release.status === 'approved'
                                ? 'bg-blue-600'
                                : 'bg-gray-600'
                          }`}>
                            {release.status}
                          </span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No releases</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-gray-500">
              <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Select an artist to view catalog</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
