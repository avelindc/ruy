import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Users, Music, Disc3, List, FileText, TrendingUp, DollarSign, CreditCard, History, LogOut, Globe } from 'lucide-react';

import { useAuth } from '@contexts/AuthContext';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const currentPath = location.pathname;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const adminNavItems = [
    { label: 'Overview', href: '/admin', icon: BarChart3 },
    { label: 'Website CMS', href: '/admin/cms', icon: Globe },
    { label: 'Streaming Analytics', href: '/admin/streaming-reports', icon: TrendingUp },
    { label: 'Katalog Musik', href: '/admin/catalog', icon: List },
    { label: 'Music Review (Releases)', href: '/admin/releases', icon: Disc3 },
    { label: 'Users Management', href: '/admin/users', icon: Users },
    { label: 'Artists Management', href: '/admin/artists', icon: Music },
    { label: 'CSV Import DSP', href: '/admin/csv-import', icon: FileText },
    { label: 'Royalties Management', href: '/admin/royalties', icon: DollarSign },
    { label: 'Withdrawals Approval', href: '/admin/withdrawals', icon: CreditCard },
    { label: 'Transactions', href: '/admin/transactions', icon: History },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: History },
  ];

  const isItemActive = (href: string) => {
    if (href === '/admin') return currentPath === '/admin';
    return currentPath.startsWith(href);
  };

  return (
    <div className="w-full bg-[#131417] h-full flex flex-col justify-between py-6 px-4 border-r border-white/[0.04] select-none text-gray-300 font-sans">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-3 mb-5">
        <Link to="/admin" className="flex items-center gap-2.5 group">
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
              Admin Portal
            </p>
          </div>
        </Link>
        <span className="px-2 py-0.5 rounded-full bg-[#FF6A3D]/20 border border-[#FF6A3D]/30 text-[9px] font-bold text-[#FF6A3D] tracking-wider uppercase">
          ADMIN
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.href);
          return (
            <Link
              key={item.label}
              to={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all group ${
                active
                  ? 'text-white font-bold bg-[#1e1f25] border border-white/[0.06] shadow-sm'
                  : 'text-[#8E92A0] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-colors ${active ? 'text-[#FF6A3D]' : 'text-[#787D8D] group-hover:text-white'}`} />
                <span className="truncate">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom Section - Log Out Button */}
      <div className="pt-3 mt-2 border-t border-white/[0.04] space-y-2">
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
