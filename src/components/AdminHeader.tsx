import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Settings, LogOut, Shield, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MONITORING' | 'LOGS'>('OVERVIEW');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const adminName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Administrator');

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
      {/* Category Tabs & Mobile Menu */}
      <div className="flex items-center gap-3 sm:gap-6">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:text-white"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-6">
        {(['OVERVIEW', 'MONITORING', 'LOGS'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'LOGS') navigate('/admin/audit-logs');
                if (tab === 'OVERVIEW') navigate('/admin');
              }}
              className={`text-xs font-bold tracking-wider transition-all relative py-1 ${
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

      {/* Center Search Pill */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Type here to search users, releases, ISRC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#14141B] text-white text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-white/[0.07] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500 shadow-inner"
          />
        </div>
      </div>

      {/* Right: Notifications, Settings, Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <Link
          to="/admin/audit-logs"
          className="w-9 h-9 rounded-xl bg-[#14141B] border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white hover:border-white/[0.15] transition-all relative group"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1]" />
        </Link>

        {/* Settings */}
        <Link
          to="/admin/settings"
          className="w-9 h-9 rounded-xl bg-[#14141B] border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white hover:border-white/[0.15] transition-all"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Admin Profile Pill */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl bg-[#14141B] border border-white/[0.08] hover:border-white/[0.2] transition-all cursor-pointer"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-gray-200">
              {adminName}
            </span>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-[#161620] border border-white/[0.1] rounded-2xl shadow-2xl py-2 z-50 text-xs backdrop-blur-md">
              <div className="px-4 py-2 border-b border-white/[0.06]">
                <p className="text-white font-semibold truncate">{adminName}</p>
                <p className="text-[10px] text-indigo-400 font-medium">Administrator</p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
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
