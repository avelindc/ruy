import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Settings, LogOut, User, Shield, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';

interface MusicHeaderProps {
  userName?: string;
  userAvatar?: string;
  onToggleMobileMenu?: () => void;
}

export default function MusicHeader({
  userName,
  userAvatar,
  onToggleMobileMenu
}: MusicHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'MUSIC' | 'PODCAST' | 'LIVE'>('MUSIC');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { logout, user, userRole, isAdmin: authIsAdmin } = useAuth();

  const displayName = userName || user?.fullName || (user?.email ? user.email.split('@')[0] : 'Artis');
  const isAdmin = Boolean(authIsAdmin || ['admin', 'super_admin', 'superadmin'].includes((userRole || '').toLowerCase().trim()));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="bg-[#0B0B0E] border-b border-white/[0.06] px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-4 z-20 min-w-0">
      {/* LEFT: Mobile Menu Button & Category Navigation Tabs */}
      <div className="flex items-center gap-3 sm:gap-6">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:text-white"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-5">
          {(['MUSIC', 'PODCAST', 'LIVE'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-bold tracking-wider transition-all relative py-1 cursor-pointer ${
                  isActive
                    ? 'text-indigo-400 font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER: Search Bar Pill */}
      <div className="flex-1 max-w-xs sm:max-w-md mx-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari lagu, artis, atau album..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#14141B] text-white text-xs pl-9 pr-3.5 py-2 rounded-xl border border-white/[0.07] focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-500 shadow-inner"
          />
        </div>
      </div>

      {/* RIGHT: Notifications, Settings, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Notification Bell */}
        <Link
          to="/dashboard/notifications"
          className="w-8 h-8 rounded-xl bg-[#14141B] border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white hover:border-white/[0.15] transition-all relative"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1]" />
        </Link>

        {/* Settings Icon */}
        <Link
          to="/dashboard/settings"
          className="hidden sm:flex w-8 h-8 rounded-xl bg-[#14141B] border border-white/[0.06] items-center justify-center text-gray-400 hover:text-white hover:border-white/[0.15] transition-all"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>

        {/* User Profile Pill */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-[#14141B] border border-white/[0.08] hover:border-white/[0.2] transition-all cursor-pointer"
          >
            <div className="w-6 h-6 rounded-lg overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
              {userAvatar ? (
                <img src={userAvatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-xs font-semibold text-gray-200 max-w-[90px] truncate">
              {displayName}
            </span>
          </button>

          {/* User Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[#161620] border border-white/[0.1] rounded-2xl shadow-2xl py-2 z-50 text-xs backdrop-blur-md">
              <div className="px-4 py-2 border-b border-white/[0.06]">
                <p className="text-white font-semibold truncate">{displayName}</p>
                <p className="text-[10px] text-gray-400 capitalize">{isAdmin ? 'Administrator' : 'Artist / User'}</p>
              </div>

              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-indigo-400 hover:bg-white/[0.05] transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Panel</span>
                </Link>
              )}

              <Link
                to="/dashboard/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-gray-300 hover:bg-white/[0.05] transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile Settings</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
