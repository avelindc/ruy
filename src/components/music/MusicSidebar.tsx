import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Disc3, Music2, Users, BarChart3, DollarSign, Wallet, History, Mail, Settings, ShieldCheck, CheckCircle2, LogOut, ArrowUpRight } from 'lucide-react';
import { getWalletInfo } from '@services/withdrawalService';
import { useEffect, useState } from 'react';
import { useAuth } from '@contexts/AuthContext';

export default function MusicSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, userRole, isAdmin: authIsAdmin, user } = useAuth();
  const currentPath = location.pathname;
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const isAdmin = Boolean(authIsAdmin || ['admin', 'super_admin', 'superadmin'].includes((userRole || '').toLowerCase().trim()));

  useEffect(() => {
    const updateBalance = async () => {
      if (!user) return;
      const result = await getWalletInfo(user.id);
      if (!result.error && result.data) setWalletBalance(result.data.balance);
    };
    void updateBalance();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Streaming Analytics', icon: BarChart3, path: '/dashboard/analytics' },
    { label: 'Katalog Musik', icon: Music2, path: '/dashboard/catalog' },
    { label: 'My Releases (Submit)', icon: Disc3, path: '/dashboard/releases', badge: 'Rilis' },
    { label: 'Artists', icon: Users, path: '/dashboard/artists' },
    { label: 'Royalti & Laporan', icon: DollarSign, path: '/dashboard/royalties' },
    { label: 'Tarik Saldo (Withdraw)', icon: Wallet, path: '/dashboard/withdrawals' },
    { label: 'Riwayat Transaksi', icon: History, path: '/dashboard/transactions' },
    { label: 'Message Center', icon: Mail, path: '/dashboard/notifications' },
    { label: 'Identity Verif', icon: CheckCircle2, path: '/dashboard/settings' },
    { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
  ];

  const isItemActive = (path: string) => {
    if (path === '/dashboard') return currentPath === '/dashboard';
    return currentPath.startsWith(path);
  };

  return (
    <div className="w-full bg-[#131417] h-full flex flex-col justify-between py-6 px-4 border-r border-white/[0.04] select-none text-gray-300 font-sans">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-3 mb-5">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#A855F7] to-[#FF6A3D] flex items-center justify-center text-white shadow-md">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10v4" />
              <path d="M6 7v10" />
              <path d="M10 4v16" />
              <path d="M14 8v8" />
              <path d="M18 5v14" />
              <path d="M22 10v4" />
            </svg>
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white group-hover:text-orange-200 transition-colors">
              BREAKOUT
            </span>
            <p className="text-[9px] text-[#FF6A3D] font-bold tracking-widest uppercase -mt-0.5">
              MUSIC PORTAL
            </p>
          </div>
        </Link>
      </div>

      {/* Main Vertical Navigation */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.path);
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all group ${
                active
                  ? 'text-white font-bold bg-[#1e1f25] border border-white/[0.06] shadow-sm'
                  : 'text-[#8E92A0] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-[#FF6A3D]' : 'text-[#787D8D] group-hover:text-white'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && !active && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FF6A3D]/20 text-[#FF6A3D]">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Switch to Admin if user is admin */}
        {isAdmin && (
          <div className="pt-2">
            <Link
              to="/admin"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-[#1e1f25] border border-purple-500/30 text-purple-300 hover:text-white hover:border-purple-400 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Admin Command Center</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Section - Live Wallet & Log Out Button */}
      <div className="pt-3 mt-2 border-t border-white/[0.04] space-y-2.5 flex-shrink-0">
        {/* Wallet Mini Balance Card */}
        <Link
          to="/dashboard/withdrawals"
          className="block bg-[#1a1b20] border border-white/[0.04] hover:border-orange-500/30 rounded-2xl p-3 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#8E92A0] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Saldo Siap Tarik
            </span>
            <span className="text-[10px] text-[#FF6A3D] font-bold group-hover:underline">
              Tarik &rarr;
            </span>
          </div>
          <p className="text-sm font-extrabold text-white tracking-tight">
            {walletBalance === null ? '—' : `$${walletBalance.toFixed(2)} USD`}
          </p>
        </Link>

        {/* Log Out Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-semibold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
