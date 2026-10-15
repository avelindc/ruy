import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function PublicNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-[#0B0B0E]/95 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-50 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#4F67FF] flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10v4" />
                <path d="M6 7v10" />
                <path d="M10 4v16" />
                <path d="M14 8v8" />
                <path d="M18 5v14" />
                <path d="M22 10v4" />
              </svg>
            </div>
            <span className="text-xl font-black tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              BREAKOUT <span className="text-[#4F67FF]">MUSIC</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8 text-sm">
            <Link to="/" className="text-gray-300 hover:text-white font-medium transition">
              Home
            </Link>
            <a href="#distribution" className="text-gray-400 hover:text-white font-medium transition">
              Distribusi
            </a>
            <a href="#features" className="text-gray-400 hover:text-white font-medium transition">
              Fitur Platform
            </a>
            <a href="#for-artists" className="text-gray-400 hover:text-white font-medium transition">
              Untuk Musisi
            </a>
            <a href="#faq" className="text-gray-400 hover:text-white font-medium transition">
              FAQ
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-3 text-sm">
            <Link to="/login" className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/[0.05] transition-all font-semibold">
              Masuk
            </Link>
            <Link to="/register" className="px-5 py-2.5 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold transition-all shadow-[0_4px_16px_rgba(79,103,255,0.4)] hover:scale-105 active:scale-95">
              Mulai Distribusi
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl bg-white/[0.05] text-gray-300 hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Navigation"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-white/[0.08] space-y-2 text-sm">
            <Link to="/" className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-white/[0.05] rounded-xl" onClick={() => setIsOpen(false)}>
              Home
            </Link>
            <a href="#distribution" className="block px-3 py-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl" onClick={() => setIsOpen(false)}>
              Distribusi
            </a>
            <a href="#features" className="block px-3 py-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl" onClick={() => setIsOpen(false)}>
              Fitur Platform
            </a>
            <a href="#for-artists" className="block px-3 py-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl" onClick={() => setIsOpen(false)}>
              Untuk Musisi
            </a>
            <a href="#faq" className="block px-3 py-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl" onClick={() => setIsOpen(false)}>
              FAQ
            </a>
            <div className="flex flex-col space-y-2 pt-3">
              <Link to="/login" className="btn-secondary w-full text-center" onClick={() => setIsOpen(false)}>
                Masuk
              </Link>
              <Link to="/register" className="btn-primary w-full text-center" onClick={() => setIsOpen(false)}>
                Mulai Distribusi Gratis
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
