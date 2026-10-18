import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Music, Users, Disc3, List, BarChart3, DollarSign, CreditCard, Bell, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';

interface UserSidebarProps {
  open: boolean;
  onToggle: () => void;
}

const menuItems = [
  { label: 'Overview', href: '/dashboard', icon: Music },
  { label: 'My Artists', href: '/dashboard/artists', icon: Users },
  { label: 'Releases', href: '/dashboard/releases', icon: Disc3 },
  { label: 'Catalog', href: '/dashboard/catalog', icon: List },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Royalties', href: '/dashboard/royalties', icon: DollarSign },
  { label: 'Withdrawals', href: '/dashboard/withdrawals', icon: CreditCard },
  { label: 'Transactions', href: '/dashboard/transactions', icon: Music },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function UserSidebar({ open, onToggle }: UserSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-64 bg-white border-r border-gray-200 transition-all duration-200 ${!open ? 'w-20' : ''}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <span className={`font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent ${!open ? 'hidden' : ''}`}>
            BREAKOUT
          </span>
          <button onClick={onToggle} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="px-4 py-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition ${
                    isActive
                      ? 'bg-purple-100 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={!open ? item.label : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {open && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-gray-100 m-4 rounded-lg transition"
          title={!open ? 'Logout' : ''}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {open && <span className="text-sm font-medium">Logout</span>}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onToggle}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 w-64 max-w-[85vw] flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div>
              <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
                <span className="font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  BREAKOUT
                </span>
                <button
                  onClick={onToggle}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                  aria-label="Tutup menu"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              <nav className="px-4 py-6">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onToggle}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition ${
                        isActive
                          ? 'bg-purple-100 text-purple-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut size={20} />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
