import { Outlet } from 'react-router-dom';
import PublicNav from '@components/PublicNav';
import Footer from '@components/Footer';

export default function PublicLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0B0B0E] text-white">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
