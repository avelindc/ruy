import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@lib/validation/schemas';
import { useAuth } from '@contexts/AuthContext';
import { AlertCircle, CheckCircle2, Lock, Mail, User, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const result = await registerAccount(data.email, data.password, data.full_name);

      if (!result.success) {
        setErrorMessage(result.error || 'Gagal mendaftar akun. Silakan coba lagi.');
        setIsLoading(false);
        return;
      }

      if (!result.user) {
        setErrorMessage('Pembuatan akun gagal. Silakan coba lagi.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('Akun berhasil dibuat! Mengarahkan ke dashboard...');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage('Terjadi kesalahan jaringan. Silakan coba lagi.');
      console.error('Register error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#12141C] border border-white/[0.08] p-7 sm:p-9 rounded-3xl shadow-2xl space-y-6 text-white">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <Link to="/" className="inline-flex items-center gap-2 mb-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-[#4F67FF] flex items-center justify-center text-white shadow-lg">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10v4" />
              <path d="M6 7v10" />
              <path d="M10 4v16" />
              <path d="M14 8v8" />
              <path d="M18 5v14" />
              <path d="M22 10v4" />
            </svg>
          </div>
          <span className="text-2xl font-black tracking-tight text-white group-hover:text-indigo-300 transition-colors">
            BREAKOUT <span className="text-[#4F67FF]">MUSIC</span>
          </span>
        </Link>
        <h1 className="text-xl font-extrabold text-white">Daftar Akun Musisi Baru</h1>
        <p className="text-xs text-gray-400">Distribusikan lagu Anda ke Spotify, TikTok, dan 150+ platform</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-rose-400 text-xs leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-400 text-xs leading-relaxed">{successMessage}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Nama Lengkap / Nama Panggung</label>
          <div className="relative">
            <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nama lengkap atau nama panggung"
              className="w-full bg-[#161824] border border-white/[0.1] rounded-xl text-xs text-white pl-10 pr-4 py-2.5 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              disabled={isLoading}
              {...register('full_name')}
            />
          </div>
          {errors.full_name && <p className="text-xs text-rose-400 mt-1">{errors.full_name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Alamat Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="nama@email.com"
              className="w-full bg-[#161824] border border-white/[0.1] rounded-xl text-xs text-white pl-10 pr-4 py-2.5 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              disabled={isLoading}
              {...register('email')}
            />
          </div>
          {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Kata Sandi</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              placeholder="Minimal 8 karakter"
              className="w-full bg-[#161824] border border-white/[0.1] rounded-xl text-xs text-white pl-10 pr-4 py-2.5 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              disabled={isLoading}
              {...register('password')}
            />
          </div>
          {errors.password && <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Konfirmasi Kata Sandi</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              placeholder="Ulangi kata sandi"
              className="w-full bg-[#161824] border border-white/[0.1] rounded-xl text-xs text-white pl-10 pr-4 py-2.5 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              disabled={isLoading}
              {...register('confirm_password')}
            />
          </div>
          {errors.confirm_password && <p className="text-xs text-rose-400 mt-1">{errors.confirm_password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white text-xs font-bold transition-all shadow-[0_8px_20px_rgba(79,103,255,0.4)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
        >
          <span>{isLoading ? 'Sedang Mendaftarkan...' : 'Daftar Sekarang'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="text-center pt-2 border-t border-white/[0.06] text-xs text-gray-400">
        Sudah memiliki akun?{' '}
        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
          Masuk di Sini
        </Link>
      </div>
    </div>
  );
}
