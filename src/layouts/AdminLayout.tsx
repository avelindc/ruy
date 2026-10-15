import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AdminSidebar from '@components/AdminSidebar';
import AdminHeader from '@components/AdminHeader';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleToggle = () => setMobileMenuOpen(prev => !prev);
    window.addEventListener('toggle-admin-mobile-menu', handleToggle);
    return () => window.removeEventListener('toggle-admin-mobile-menu', handleToggle);
  }, []);

  const isOverview = location.pathname === '/admin';

  return (
    <div className="h-screen w-screen bg-[#131417] text-white overflow-hidden flex flex-row font-sans relative">
      {/* 1. Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. Left Admin Sidebar (Fixed on Desktop, Drawer on Mobile) */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-20 h-full w-[250px] flex-shrink-0 transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <AdminSidebar />
      </aside>

      {/* 3. Middle Main Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#131417]">
        {!isOverview && (
          <AdminHeader onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        )}

        {/* Scrollable Center Content with unified max-width */}
        <main className={`flex-1 overflow-y-auto ${isOverview ? 'px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6' : 'px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7'} custom-scrollbar`}>
          <div className="max-w-[1600px] mx-auto w-full pb-16 min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
