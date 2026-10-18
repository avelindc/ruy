import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, TrendingUp, DollarSign, BarChart3, Plus, Loader } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { getUserArtists } from '@services/artistService';
import { getUserReleases } from '@services/releaseService';
import { getWalletTransactions } from '@services/withdrawalService';
import { apiGet } from '@lib/api/client';

export default function DashboardOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStreams: null as number | null,
    availableBalance: null as number | null,
    balanceFormatted: '—',
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

        // Fetch artists, releases, wallet transactions, and streaming aggregates
        const [artistsRes, releasesRes, walletRes, streamsRes] = await Promise.all([
          getUserArtists(user.id),
          getUserReleases(user.id),
          getWalletTransactions(user.id),
          apiGet<any>('/api/artist-streaming-aggregates').catch(() => ({ success: false, data: { data: [] } })),
        ]);

        if (artistsRes.error) throw artistsRes.error;
        if (releasesRes.error) throw releasesRes.error;

        // Process wallet balance from financial ledger
        const summary = walletRes.summary || [];
        let primaryBalanceText = '—';
        let primaryBalanceNum = 0;
        if (summary.length > 0) {
          primaryBalanceText = summary
            .map((s: { currency: string; balance: number }) => {
              const formatted = new Intl.NumberFormat('id-ID', {
                minimumFractionDigits: Math.floor(s.balance) === s.balance ? 0 : 2,
                maximumFractionDigits: 2,
              }).format(s.balance);
              return s.currency === 'IDR' ? `Rp ${formatted}` : `${s.currency} ${formatted}`;
            })
            .join(' · ');
          primaryBalanceNum = summary.reduce((sum: number, s: { balance: number }) => sum + Number(s.balance || 0), 0);
        }

        // Process streams
        const streamRows: any[] = streamsRes.data?.data || [];
        const aggregateRows = streamRows.filter((r) => r.platform?.toLowerCase() === 'agregat' || r.platform?.toLowerCase() === 'all');
        const platformRows = streamRows.filter((r) => r.platform?.toLowerCase() !== 'agregat' && r.platform?.toLowerCase() !== 'all');
        const totalStreams = aggregateRows.length > 0
          ? aggregateRows.reduce((sum, r) => sum + Number(r.streams || 0), 0)
          : platformRows.reduce((sum, r) => sum + Number(r.streams || 0), 0);

        setStats({
          totalStreams: totalStreams > 0 ? totalStreams : null,
          availableBalance: summary.length > 0 ? primaryBalanceNum : null,
          balanceFormatted: primaryBalanceText,
          totalArtists: artistsRes.data?.length || 0,
          totalReleases: releasesRes.data?.length || 0,
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
    {
      label: 'Total Streams',
      value: stats.totalStreams != null
        ? new Intl.NumberFormat('id-ID').format(stats.totalStreams)
        : '—',
      icon: Music,
      color: 'purple',
    },
    { label: 'Monthly Performance', value: '—', icon: TrendingUp, color: 'blue' },
    {
      label: 'Available Balance',
      value: stats.balanceFormatted,
      icon: DollarSign,
      color: 'green',
    },
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
