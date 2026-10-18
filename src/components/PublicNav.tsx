import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function PublicNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-[#e9e4d8]/95 backdrop-blur-md border-b border-black/10 sticky top-0 z-50 text-[#191a17]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-full bg-[#191a17] flex items-center justify-center text-[#c8f05a]">
              <svg className="w-5 h-5 text-[#c8f05a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10v4" />
                <path d="M6 7v10" />
                <path d="M10 4v16" />
                <path d="M14 8v8" />
                <path d="M18 5v14" />
                <path d="M22 10v4" />
              </svg>
            </div>
            <span className="text-xl font-black tracking-tight text-[#191a17] group-hover:text-[#8f355b] transition-colors">
              BREAKOUT <span className="text-[#8f355b]">MUSIC</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8 text-sm">
            <Link to="/" className="text-[#55564f] hover:text-[#191a17] font-medium transition">
              Home
            </Link>
            <a href="#perjalanan" className="text-[#77786f] hover:text-[#191a17] font-medium transition">
              Distribusi
            </a>
            <a href="#features" className="text-[#77786f] hover:text-[#191a17] font-medium transition">
              Fitur Platform
            </a>
            <a href="#testimonials" className="text-[#77786f] hover:text-[#191a17] font-medium transition">
              Cerita
            </a>
            <a href="#faq" className="text-[#77786f] hover:text-[#191a17] font-medium transition">
              FAQ
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-3 text-sm">
            <Link to="/login" className="px-4 py-2 text-[#55564f] hover:text-[#191a17] transition-all font-semibold">
              Masuk
            </Link>
            <Link to="/register" className="px-5 py-2.5 bg-[#191a17] hover:bg-[#8f355b] text-[#f1eee4] font-bold transition-all">
              Mulai Distribusi
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl bg-black/[0.05] text-[#55564f] hover:text-[#191a17]"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Navigation"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-black/[0.1] space-y-2 text-sm">
            <Link to="/" className="block px-3 py-2 text-[#55564f] hover:text-[#191a17] hover:bg-black/[0.04] rounded-xl" onClick={() => setIsOpen(false)}>
              Home
            </Link>
            <a href="#perjalanan" className="block px-3 py-2 text-[#77786f] hover:text-[#191a17] hover:bg-black/[0.04] rounded-xl" onClick={() => setIsOpen(false)}>
              Distribusi
            </a>
            <a href="#features" className="block px-3 py-2 text-[#77786f] hover:text-[#191a17] hover:bg-black/[0.04] rounded-xl" onClick={() => setIsOpen(false)}>
              Fitur Platform
            </a>
            <a href="#testimonials" className="block px-3 py-2 text-[#77786f] hover:text-[#191a17] hover:bg-black/[0.04] rounded-xl" onClick={() => setIsOpen(false)}>
              Cerita
            </a>
            <a href="#faq" className="block px-3 py-2 text-[#77786f] hover:text-[#191a17] hover:bg-black/[0.04] rounded-xl" onClick={() => setIsOpen(false)}>
              FAQ
            </a>
            <div className="flex flex-col space-y-2 pt-3">
              <Link to="/login" className="w-full px-4 py-2.5 text-center font-semibold border border-black/15 rounded-xl" onClick={() => setIsOpen(false)}>
                Masuk
              </Link>
              <Link to="/register" className="w-full px-4 py-2.5 text-center font-semibold bg-[#191a17] text-[#f1eee4] rounded-xl" onClick={() => setIsOpen(false)}>
                Mulai Distribusi Gratis
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
