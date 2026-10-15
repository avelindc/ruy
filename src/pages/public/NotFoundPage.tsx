import { Link } from 'react-router-dom';
import { ArrowLeft, Disc3 } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0E] text-white px-4">
      <div className="text-center max-w-md mx-auto relative z-10">
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6 text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
          <Disc3 className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
        <h1 className="text-7xl font-black text-white mb-2 tracking-tight">404</h1>
        <p className="text-xl font-bold text-gray-200 mb-3">Halaman Tidak Ditemukan</p>
        <p className="text-xs text-gray-400 mb-8 leading-relaxed">
          Halaman atau rilisan yang Anda cari mungkin telah dipindahkan atau tautan tidak valid.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-[0_8px_20px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>
    </div>
  );
}
