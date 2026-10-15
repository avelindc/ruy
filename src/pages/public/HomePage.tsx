import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  DollarSign,
  Disc3,
  Globe,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MessageSquareQuote,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Star,
  ShieldCheck
} from 'lucide-react';
import {
  getLandingContent,
  CmsLandingSection,
  CmsTestimonial,
  CmsFaqCategory,
  CmsScrollytelling,
} from '@services/cmsService';
import { ScrollytellingCanvas } from '../../components/scrollytelling/ScrollytellingCanvas';

export default function HomePage() {
  const [sections, setSections] = useState<CmsLandingSection[]>([]);
  const [testimonials, setTestimonials] = useState<CmsTestimonial[]>([]);
  const [faqCategories, setFaqCategories] = useState<CmsFaqCategory[]>([]);
  const [scrollytelling, setScrollytelling] = useState<CmsScrollytelling | null>(null);
  const [activeFaqCatId, setActiveFaqCatId] = useState<string>('');
  const [openFaqItems, setOpenFaqItems] = useState<Record<string, boolean>>({});
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data } = await getLandingContent();
        if (data) {
          if (data.sections && data.sections.length > 0) {
            setSections(data.sections.filter(s => s.is_enabled));
          }
          if (data.testimonials && data.testimonials.length > 0) {
            setTestimonials(data.testimonials);
          }
          if (data.faq_categories && data.faq_categories.length > 0) {
            setFaqCategories(data.faq_categories);
            setActiveFaqCatId(data.faq_categories[0].id);
          }
          if (data.scrollytelling) {
            setScrollytelling(data.scrollytelling);
          }
        }
      } catch (err) {
        console.error('Failed to load dynamic landing content:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const toggleFaq = (id: string) => {
    setOpenFaqItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const activeCategory = faqCategories.find(c => c.id === activeFaqCatId) || faqCategories[0];

  // Helper to check section enablement
  const isSectionEnabled = (key: string) => {
    if (sections.length === 0) return true; // Default enable if still loading
    const sec = sections.find(s => s.section_key === key);
    return sec ? sec.is_enabled : true;
  };

  const getSectionTitle = (key: string, defaultTitle: string) => {
    const sec = sections.find(s => s.section_key === key);
    return sec?.title || defaultTitle;
  };

  const getSectionSubtitle = (key: string, defaultSub: string) => {
    const sec = sections.find(s => s.section_key === key);
    return sec?.subtitle || defaultSub;
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ========================================================================= */}
      {isSectionEnabled('hero') && (
        <section id="hero" className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-purple-600/15 via-[#4F67FF]/20 to-transparent blur-[120px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Copy */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Platform Distribusi Musik Independen #1</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] tracking-tight">
                  Karya Musikmu.{' '}
                  <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-[#4F67FF] bg-clip-text text-transparent">
                    Hak Ciptamu.
                  </span>{' '}
                  Panggung Duniamu.
                </h1>

                <p className="text-base sm:text-lg text-gray-300 max-w-xl leading-relaxed">
                  Distribusikan rilisan musikmu ke 150+ platform digital global seperti Spotify, Apple Music, TikTok, dan YouTube. Pantau data streaming realtime serta tarik royalti langsung ke rekening Bank &amp; E-Wallet Indonesia.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
                  <Link
                    to="/register"
                    className="px-7 py-3.5 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold text-sm transition-all shadow-[0_8px_24px_rgba(79,103,255,0.45)] hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Mulai Rilis Lagu Gratis</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="px-6 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold text-sm transition-all flex items-center justify-center cursor-pointer"
                  >
                    Masuk ke Dasbor
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    100% Hak Master Milikmu
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Penarikan Bank &amp; E-Wallet IDR
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Klip TikTok Timestamp
                  </span>
                </div>
              </div>

              {/* Right Card / Visual Showcase */}
              <div className="lg:col-span-5 relative">
                <div className="bg-[#14141B] border border-white/[0.08] rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">breakout-distribution-engine</span>
                  </div>

                  {/* Feature 1 */}
                  <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Distribusi Global 150+ DSP</p>
                      <p className="text-xs text-gray-400">Spotify, TikTok, Apple Music, YouTube</p>
                    </div>
                  </div>

                  {/* Feature 2 */}
                  <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Laporan Streaming Realtime</p>
                      <p className="text-xs text-gray-400">Analitik putaran harian dan bulanan</p>
                    </div>
                  </div>

                  {/* Feature 3 */}
                  <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Pencairan Bank &amp; E-Wallet</p>
                      <p className="text-xs text-gray-400">BCA, Mandiri, BRI, DANA, GoPay, OVO</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. STATS KPI SECTION */}
      {/* ========================================================================= */}
      {isSectionEnabled('stats') && (
        <section id="stats" className="bg-[#121217] border-y border-white/[0.06] py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="p-4 rounded-2xl bg-[#14141B]/60 border border-white/[0.04]">
                <p className="text-2xl sm:text-3xl font-black text-white mb-1">50K+</p>
                <p className="text-xs text-gray-400 font-medium">Musisi Independen</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#14141B]/60 border border-white/[0.04]">
                <p className="text-2xl sm:text-3xl font-black text-[#4F67FF] mb-1">1.2B+</p>
                <p className="text-xs text-gray-400 font-medium">Streams Terdistribusi</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#14141B]/60 border border-white/[0.04]">
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 mb-1">Rp 120M+</p>
                <p className="text-xs text-gray-400 font-medium">Royalti Dicairkan</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#14141B]/60 border border-white/[0.04]">
                <p className="text-2xl sm:text-3xl font-black text-purple-400 mb-1">150+</p>
                <p className="text-xs text-gray-400 font-medium">Platform DSP Aktif</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2.5 SCROLL-LINKED ANIMATION (CANVAS SCROLLYTELLING) */}
      {/* ========================================================================= */}
      {scrollytelling && scrollytelling.is_enabled && (
        <ScrollytellingCanvas config={scrollytelling} />
      )}

      {/* ========================================================================= */}
      {/* 3. FEATURES SECTION */}
      {/* ========================================================================= */}
      {isSectionEnabled('features') && (
        <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Semua Yang Kamu Butuhkan
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-4 tracking-tight">
              {getSectionTitle('features', 'Fitur Canggih untuk Musisi Era Baru')}
            </h2>
            <p className="text-sm text-gray-400">
              {getSectionSubtitle('features', 'Platform all-in-one dari submit rilis lagu, review kurasi cepat, katalog publik, hingga pencairan royalti transparan.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#14141B] border border-white/[0.08] p-6 rounded-3xl space-y-4 hover:border-indigo-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <Disc3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Rilis Lagu Cepat &amp; Presisi</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Upload master audio MP3, artwork beresolusi tinggi, buat profil artis baru, dan tentukan potongan preview klip TikTok (timestamp seperti 00:30).
              </p>
            </div>

            <div className="bg-[#14141B] border border-white/[0.08] p-6 rounded-3xl space-y-4 hover:border-indigo-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Analitik &amp; Royalti Singkron</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Data streaming dari Spotify, Apple Music, dan TikTok tersinkronisasi langsung saat admin menginput laporan ke akun dasbor Anda.
              </p>
            </div>

            <div className="bg-[#14141B] border border-white/[0.08] p-6 rounded-3xl space-y-4 hover:border-indigo-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Withdraw Bank &amp; E-Wallet IDR</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Tarik saldo royalti tanpa ribet ke rekening BCA, Mandiri, BNI, BRI, BSI atau E-Wallet DANA, GoPay, OVO, ShopeePay dalam hitungan hari.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. ARTIST TESTIMONIALS SECTION (REAL FEEDBACK / WHAT ARTISTS SAY) */}
      {/* ========================================================================= */}
      {isSectionEnabled('testimonials') && testimonials.length > 0 && (
        <section id="testimonials" className="py-20 bg-[#0E0E13] border-y border-white/[0.06] relative overflow-hidden">
          {/* Ambient subtle glow */}
          <div className="absolute top-1/2 right-10 w-96 h-96 bg-lime-500/5 blur-[140px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Header with Lime Badge following design reference */}
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-lime-400/10 border border-lime-400/30 text-lime-400 text-xs font-bold tracking-widest uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>REAL FEEDBACK / WHAT ARTISTS SAY</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {getSectionTitle('testimonials', 'Dipercaya Musisi & Produser')}
              </h2>
              <p className="text-sm text-gray-400">
                {getSectionSubtitle('testimonials', 'Cerita nyata dari kreator musik independen yang mendistribusikan karya mereka melalui Breakout Music.')}
              </p>
            </div>

            {/* Testimonials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((item) => (
                <div
                  key={item.id}
                  className="p-7 rounded-3xl bg-[#14141B] border border-white/[0.08] hover:border-lime-400/40 transition-all flex flex-col justify-between space-y-6 shadow-xl relative group hover:shadow-[0_8px_30px_rgba(163,230,53,0.12)]"
                >
                  <div className="space-y-4">
                    {/* Top rating stars & quote icon */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-lime-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-lime-400 text-lime-400" />
                        ))}
                      </div>
                      <MessageSquareQuote className="w-6 h-6 text-lime-400/40 group-hover:text-lime-400 transition-colors" />
                    </div>

                    {/* Quote text */}
                    <p className="text-sm text-gray-300 italic leading-relaxed">
                      "{item.quote}"
                    </p>
                  </div>

                  {/* Artist Details */}
                  <div className="flex items-center gap-3.5 pt-4 border-t border-white/[0.06]">
                    <img
                      src={item.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&fit=crop&q=80'}
                      alt={item.artist_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-lime-400/40 shadow-md bg-[#1C1C26]"
                      onError={(e) => {
                        (e.target as any).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&fit=crop&q=80';
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-black text-white truncate">{item.artist_name}</p>
                        <ShieldCheck className="w-4 h-4 text-lime-400 flex-shrink-0" />
                      </div>
                      <p className="text-xs font-semibold text-lime-400 tracking-wide truncate">
                        {item.role_label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. FAQ ACCORDION SECTION (5 Kategori: FAQ Umum, CTM, DMD, Royalty, Rilis) */}
      {/* ========================================================================= */}
      {isSectionEnabled('faq') && faqCategories.length > 0 && (
        <section id="faq" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-widest">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pertanyaan yang Sering Diajukan</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {getSectionTitle('faq', 'FAQ Distribusi Musik')}
            </h2>
            <p className="text-sm text-gray-400">
              {getSectionSubtitle('faq', 'Pelajari mekanisme perlindungan hak cipta, monetisasi CTM, pengiriman ke DSP, dan pencairan royalti.')}
            </p>
          </div>

          {/* Dynamic Categories Tab Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
            {faqCategories.map((cat) => {
              const isSelected = (activeFaqCatId || faqCategories[0]?.id) === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveFaqCatId(cat.id)}
                  className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-[#4F67FF] text-white border-indigo-400 shadow-[0_4px_16px_rgba(79,103,255,0.4)] scale-105'
                      : 'bg-[#14141B] text-gray-400 border-white/[0.08] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Category Description Banner */}
          {activeCategory?.description && (
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center mb-6 text-xs text-gray-400 max-w-xl mx-auto">
              {activeCategory.description}
            </div>
          )}

          {/* Accordion List */}
          <div className="space-y-3.5">
            {(activeCategory?.items || []).map((faq) => {
              const isOpen = openFaqItems[faq.id] ?? false;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isOpen
                      ? 'bg-[#14141B] border-indigo-500/40 shadow-lg'
                      : 'bg-[#14141B]/70 border-white/[0.08] hover:border-white/[0.15]'
                  }`}
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full p-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                  >
                    <span className={`text-sm sm:text-base font-bold transition-colors ${
                      isOpen ? 'text-indigo-300' : 'text-white'
                    }`}>
                      {faq.question}
                    </span>
                    <div className={`p-1.5 rounded-lg border transition-all flex-shrink-0 ${
                      isOpen
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                        : 'bg-white/[0.04] border-white/[0.06] text-gray-400'
                    }`}>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-300 leading-relaxed border-t border-white/[0.04]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}

            {(!activeCategory?.items || activeCategory.items.length === 0) && (
              <div className="text-center py-12 p-6 rounded-2xl bg-[#14141B] border border-white/[0.08] text-gray-400 text-xs">
                Pertanyaan untuk kategori ini sedang diperbarui.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. CALL TO ACTION SECTION */}
      {/* ========================================================================= */}
      {isSectionEnabled('cta') && (
        <section id="cta" className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-purple-950/60 via-[#181824] to-indigo-950/60 border border-indigo-500/30 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-xl mx-auto space-y-5">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {getSectionTitle('cta', 'Siap Membawa Musikmu ke Seluruh Dunia?')}
              </h2>
              <p className="text-sm text-gray-300">
                {getSectionSubtitle('cta', 'Bergabung bersama ribuan musisi independen yang mempercayakan distribusi dan monetisasi karya mereka di Breakout Music.')}
              </p>
              <div className="pt-2">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#4F67FF] hover:bg-[#435BFF] text-white font-bold text-sm transition-all shadow-[0_8px_24px_rgba(79,103,255,0.5)] hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>Daftar Sekarang Secara Gratis</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
