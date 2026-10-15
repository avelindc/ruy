import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <div className="bg-[#12141C] border border-white/[0.08] p-7 sm:p-9 rounded-3xl shadow-2xl space-y-6 text-white">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-extrabold text-white">Reset Kata Sandi</h1>
        <p className="text-xs text-gray-400">Layanan pemulihan akun</p>
      </div>
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300 text-xs leading-relaxed">
          Pemulihan kata sandi melalui email belum tersedia. Hubungi administrator untuk bantuan akun.
        </p>
      </div>
      <div className="text-center pt-2 border-t border-white/[0.06] text-xs text-gray-400">
        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Halaman Masuk</span>
        </Link>
      </div>
    </div>
  );
}
