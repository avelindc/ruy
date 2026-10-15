import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, TrendingUp, DollarSign, BarChart3, Plus, Loader } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { getUserArtists } from '@services/artistService';
import { getUserReleases } from '@services/releaseService';

export default function DashboardOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStreams: null as number | null,
    availableBalance: null as number | null,
    totalArtists: 0,
    totalReleases: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError('');

        const user = await getCurrentUser();
        if (!user) {
          return;
        }

        // Fetch artists
        const { data: artists, error: artistsError } = await getUserArtists(user.id);
        if (artistsError) throw artistsError;

        // Fetch releases
        const { data: releases, error: releasesError } = await getUserReleases(user.id);
        if (releasesError) throw releasesError;

        setStats({
          totalStreams: null,
          availableBalance: null,
          totalArtists: artists?.length || 0,
          totalReleases: releases?.length || 0,
        });
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Streams', value: stats.totalStreams?.toLocaleString() ?? '—', icon: Music, color: 'purple' },
    { label: 'Monthly Performance', value: '—', icon: TrendingUp, color: 'blue' },
    { label: 'Available Balance', value: stats.availableBalance === null ? '—' : `$${stats.availableBalance.toFixed(2)}`, icon: DollarSign, color: 'green' },
    { label: 'Total Releases', value: stats.totalReleases.toString(), icon: BarChart3, color: 'orange' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's an overview of your music activity.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const colorClass = {
            purple: 'bg-purple-100 text-purple-600',
            blue: 'bg-blue-100 text-blue-600',
            green: 'bg-green-100 text-green-600',
            orange: 'bg-orange-100 text-orange-600',
          }[stat.color];

          return (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/dashboard/artists')}
              className="w-full flex items-center space-x-2 p-3 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition"
            >
              <Plus size={20} />
              <span>Add New Artist</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/releases')}
              className="w-full flex items-center space-x-2 p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
            >
              <Plus size={20} />
              <span>Create New Release</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/analytics')}
              className="w-full flex items-center space-x-2 p-3 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition"
            >
              <BarChart3 size={20} />
              <span>View Analytics</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/withdrawals')}
              className="w-full flex items-center space-x-2 p-3 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition"
            >
              <DollarSign size={20} />
              <span>Request Withdrawal</span>
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-purple-200 text-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">Create an Artist Profile</p>
                <p className="text-sm text-gray-600">Add yourself or other artists to your catalog</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">Submit Your First Release</p>
                <p className="text-sm text-gray-600">Upload your music and metadata for distribution</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-green-200 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Track Performance</p>
                <p className="text-sm text-gray-600">Monitor streams and earnings in real-time</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
