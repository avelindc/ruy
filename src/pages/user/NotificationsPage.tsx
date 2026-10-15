import { useEffect, useState } from 'react';
import { Loader, Bell, Trash2 } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, type Notification } from '@services/notificationsService';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoading(true);
        setError('');

        if (!user) {
          return;
        }
        const result = await getNotifications(user.id);
        if (result.error) throw result.error;
        setNotifications(result.data?.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat notifikasi.');
      } finally {
        setLoading(false);
      }
    };

    void loadNotifications();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    const result = await markNotificationAsRead(id);
    if (result.error) { setError(result.error.message); return; }
    setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const result = await markAllNotificationsAsRead(user.id);
    if (result.error) { setError(result.error.message); return; }
    setNotifications(current => current.map(n => ({ ...n, read: true })));
  };

  const handleDelete = async (id: string) => {
    const result = await deleteNotification(id);
    if (result.error) { setError(result.error.message); return; }
    setNotifications(current => current.filter(n => n.id !== id));
  };

  const filteredNotifications =
    filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Memuat notifikasi...</p>
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
            <Bell className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Pusat Pesan &amp; Notifikasi</h1>
          </div>
          <p className="text-xs text-gray-400">
            Pembaruan kurasi rilis, laporan royalti streaming, dan pemberitahuan penting akun Anda.
          </p>
        </div>

        <button
          onClick={handleMarkAllAsRead}
          className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-gray-300 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer"
        >
          Tandai Semua Sudah Dibaca
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-white text-black font-bold shadow-md'
              : 'bg-[#14141B] text-gray-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          Semua Notifikasi ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filter === 'unread'
              ? 'bg-white text-black font-bold shadow-md'
              : 'bg-[#14141B] text-gray-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          Belum Dibaca ({notifications.filter(n => !n.read).length})
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-12 text-center text-gray-500 text-xs">
            Tidak ada notifikasi saat ini.
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                notif.read
                  ? 'bg-[#14141B] border-white/[0.06] text-gray-300'
                  : 'bg-[#161622] border-indigo-500/30 text-white shadow-md'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white">{notif.title}</h3>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{notif.message}</p>
                  <p className="text-[10px] text-gray-500 mt-2 font-mono">
                    {new Date(notif.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(notif.id);
                }}
                className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors"
                title="Hapus"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
