import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, Eye, Lock, Unlock, AlertCircle } from 'lucide-react';
import { getCurrentUser } from '@lib/auth/authService';
import { getUsersWithStats, suspendUser, reactivateUser } from '@services/adminService';

interface User {
  id: string;
  full_name: string;
  account_status: string;
  created_at: string;
  artistCount: number;
  releaseCount: number;
  role: string;
}

export default function UsersManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pageSize = 20;

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError('');

        const user = await getCurrentUser();
        if (!user) {
          return;
        }

        const offset = page * pageSize;
        const { data, total: totalUsers, error: usersError } = await getUsersWithStats(
          pageSize,
          offset,
          searchQuery || undefined
        );

        if (usersError) throw usersError;

        setUsers(data || []);
        setTotal(totalUsers || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load users';
        setError(message);
        console.error('Users management error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [navigate, page, searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const handleSuspend = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user?')) return;

    try {
      setActionLoading(userId);
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { error: suspendError } = await suspendUser(userId);
      if (suspendError) throw suspendError;

      // Reload users
      const offset = page * pageSize;
      const { data } = await getUsersWithStats(pageSize, offset, searchQuery || undefined);
      setUsers(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to suspend user';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to reactivate this user?')) return;

    try {
      setActionLoading(userId);
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { error: reactivateError } = await reactivateUser(userId);
      if (reactivateError) throw reactivateError;

      // Reload users
      const offset = page * pageSize;
      const { data } = await getUsersWithStats(pageSize, offset, searchQuery || undefined);
      setUsers(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reactivate user';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
        <p className="text-gray-600">Manage platform users and account status</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">Artists</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">Releases</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Joined</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.role}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          user.account_status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.account_status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right text-gray-900 font-medium">
                      {user.artistCount}
                    </td>
                    <td className="py-4 px-6 text-right text-gray-900 font-medium">
                      {user.releaseCount}
                    </td>
                    <td className="py-4 px-6 text-gray-600 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`#`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View details"
                        >
                          <Eye size={18} />
                        </button>
                        {user.account_status === 'active' ? (
                          <button
                            onClick={() => handleSuspend(user.id)}
                            disabled={actionLoading === user.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="Suspend user"
                          >
                            <Lock size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(user.id)}
                            disabled={actionLoading === user.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                            title="Reactivate user"
                          >
                            <Unlock size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No users found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-gray-600 text-sm">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} users
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
  );
}
