import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, AudioLines, Mail } from 'lucide-react';

export default function Footer() {
  const [currentYear] = useState(() => new Date().getFullYear());

  return (
    <footer className="border-t border-white/10 bg-[#191a17] text-[#eeeae0]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] md:gap-16 md:py-16">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 text-sm font-black tracking-[.14em]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#c8f05a] text-[#191a17]">
              <AudioLines size={17} />
            </span>
            BREAKOUT <span className="-ml-2 text-[#c8f05a]">MUSIC</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-[#aaa99f]">
            Ruang kerja untuk menyiapkan rilisan dan mengelola perjalanan musikmu.
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#c8f05a]">
            Jelajahi
          </h2>
          <ul className="space-y-3 text-sm text-[#aaa99f]">
            <li><a href="#perjalanan" className="hover:text-white">Cara kerja</a></li>
            <li><a href="#features" className="hover:text-white">Ruang kerja</a></li>
            <li><a href="#faq" className="hover:text-white">Pertanyaan umum</a></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#c8f05a]">
            Akun & bantuan
          </h2>
          <ul className="space-y-3 text-sm text-[#aaa99f]">
            <li><Link to="/register" className="hover:text-white">Buat akun</Link></li>
            <li><Link to="/login" className="hover:text-white">Masuk</Link></li>
            <li><Link to="/terms" className="hover:text-white">Ketentuan layanan</Link></li>
            <li><Link to="/privacy" className="hover:text-white">Kebijakan privasi</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-white/10 px-5 py-5 text-xs text-[#92938a] sm:px-8 md:flex-row md:items-center md:justify-between">
        <span>© {currentYear} Breakout Music</span>
        <a className="inline-flex items-center gap-2 hover:text-white" href="mailto:support@breakoutmusic.com">
          <Mail size={14} /> Hubungi kami <ArrowUpRight size={13} />
        </a>
      </div>
    </footer>
  );
}
