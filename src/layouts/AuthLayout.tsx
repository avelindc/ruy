import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#090A0F] text-white px-4 py-10 relative overflow-hidden font-sans">
      {/* Ambient Brand Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-purple-600/20 via-[#4F67FF]/15 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
