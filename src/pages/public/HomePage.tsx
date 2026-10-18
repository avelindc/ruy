import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageSquareQuote,
} from 'lucide-react';
import {
  getLandingContent,
  type CmsFaqCategory,
  type CmsLandingSection,
  type CmsTestimonial,
} from '@services/cmsService';
import { RecordJourney } from '../../components/scrollytelling/RecordJourney';
import './HomePage.css';

export default function HomePage() {
  const [sections, setSections] = useState<CmsLandingSection[]>([]);
  const [testimonials, setTestimonials] = useState<CmsTestimonial[]>([]);
  const [faqCategories, setFaqCategories] = useState<CmsFaqCategory[]>([]);
  const [activeFaqCatId, setActiveFaqCatId] = useState('');
  const [openFaqItems, setOpenFaqItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    getLandingContent()
      .then(({ data }) => {
        if (!active || !data) return;
        setSections(data.sections || []);
        setTestimonials(data.testimonials || []);
        setFaqCategories(data.faq_categories || []);
        setActiveFaqCatId(data.faq_categories?.[0]?.id || '');
      })
      .catch((error) => {
        console.error('Failed to load public landing content:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const isSectionEnabled = (key: string) =>
    sections.find((section) => section.section_key === key)?.is_enabled ?? true;

  const getSectionTitle = (key: string, fallback: string) =>
    sections.find((section) => section.section_key === key)?.title || fallback;

  const getSectionSubtitle = (key: string, fallback: string) =>
    sections.find((section) => section.section_key === key)?.subtitle || fallback;

  const activeCategory =
    faqCategories.find((category) => category.id === activeFaqCatId) || faqCategories[0];

  return (
    <div className="breakout-home">
      {isSectionEnabled('hero') && (
        <section id="hero" className="home-hero">
          <div className="home-hero__topline">
            <span>BREAKOUT MUSIC</span>
            <span>RUANG GERAK MUSIK INDEPENDEN</span>
          </div>

          <div className="home-hero__grid">
            <div className="home-hero__copy">
              <p className="home-eyebrow"><span /> Untuk musisi yang siap melangkah</p>
              <h1>
                Musikmu
                <br />
                <em>jangan berhenti</em>
                <br />
                di satu tempat.
              </h1>
              <p className="home-hero__intro">
                Siapkan rilisan, kelola katalog, dan ikuti perjalanan musikmu dari satu ruang kerja.
                Kamu yang pegang kendali atas langkah berikutnya.
              </p>
              <div className="home-hero__actions">
                <Link to="/register" className="home-button home-button--ink">
                  Mulai dari sini <ArrowRight size={17} />
                </Link>
                <Link to="/login" className="home-text-link">Masuk ke akun</Link>
              </div>
              <a href="#perjalanan" className="home-hero__scroll">
                <span className="home-hero__scroll-icon"><ArrowDown size={14} /></span>
                Gulir untuk melihat alurnya
              </a>
            </div>

            <div className="home-hero__image-wrap">
              <img
                src="/images/hero-singer.jpg"
                alt="Penyanyi sedang membawakan lagu di depan mikrofon"
                className="home-hero__image"
                fetchPriority="high"
              />
              <div className="home-hero__image-shade" />
              <div className="home-hero__image-caption">
                <span>SEBUAH LAGU SELALU PUNYA CERITA</span>
                <span>01 / 04</span>
              </div>
              <div className="home-hero__image-stamp" aria-hidden="true">
                <span>PLAY</span>
                <span>YOUR</span>
                <span>PART</span>
              </div>
            </div>
          </div>

          <div className="home-hero__rail" aria-label="Ruang kerja Breakout Music">
            <span>01 <b>RILIS</b></span>
            <span>02 <b>KATALOG</b></span>
            <span>03 <b>LAPORAN</b></span>
            <span className="home-hero__rail-note">SEMUANYA DIMULAI DARI KARYAMU</span>
          </div>
        </section>
      )}

      <RecordJourney />

      {isSectionEnabled('features') && (
        <section id="features" className="home-tools">
          <div className="home-section-heading">
            <p className="home-eyebrow"><span /> Ruang kerja, bukan jalan pintas</p>
            <h2>{getSectionTitle('features', 'Semua yang penting, tetap dekat.')}</h2>
            <p>{getSectionSubtitle(
              'features',
              'Kelola proses rilisanmu dengan lebih rapi, dari persiapan sampai membaca laporan yang tersedia.',
            )}</p>
          </div>

          <div className="home-tools__list">
            <article className="home-tool-row">
              <span className="home-tool-row__number">01</span>
              <h3>Ruang rilisan</h3>
              <p>Susun detail lagu, artwork, dan informasi artis dalam satu alur yang mudah diikuti.</p>
              <span className="home-tool-row__mark" aria-hidden="true">↗</span>
            </article>
            <article className="home-tool-row">
              <span className="home-tool-row__number">02</span>
              <h3>Katalog yang rapi</h3>
              <p>Kembali ke rilisan dan profil artis tanpa harus mencari catatan yang tercecer.</p>
              <span className="home-tool-row__mark" aria-hidden="true">↗</span>
            </article>
            <article className="home-tool-row">
              <span className="home-tool-row__number">03</span>
              <h3>Laporan yang terbaca</h3>
              <p>Lihat data, transaksi, dan status pengajuan yang tersedia di dasbor akunmu.</p>
              <span className="home-tool-row__mark" aria-hidden="true">↗</span>
            </article>
          </div>
        </section>
      )}

      {isSectionEnabled('testimonials') && testimonials.length > 0 && (
        <section id="testimonials" className="home-testimonials">
          <div className="home-testimonials__heading">
            <MessageSquareQuote size={22} strokeWidth={1.5} />
            <div>
              <p className="home-eyebrow"><span /> Cerita dari pengguna</p>
              <h2>{getSectionTitle('testimonials', 'Dari mereka yang sudah berjalan.')}</h2>
              <p>{getSectionSubtitle(
                'testimonials',
                'Pengalaman pengguna Breakout Music.',
              )}</p>
            </div>
          </div>
          <div className="home-testimonials__list">
            {testimonials.map((item, index) => (
              <figure className="home-quote" key={item.id}>
                <span className="home-quote__index">0{index + 1}</span>
                <blockquote>“{item.quote}”</blockquote>
                <figcaption>
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt="" loading="lazy" />
                  ) : (
                    <span className="home-quote__initial" aria-hidden="true">
                      {item.artist_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>
                    <strong>{item.artist_name}</strong>
                    <small>{item.role_label}</small>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {isSectionEnabled('faq') && faqCategories.length > 0 && (
        <section id="faq" className="home-faq">
          <div className="home-faq__heading">
            <p className="home-eyebrow"><span /> Sebelum kamu mulai</p>
            <h2>{getSectionTitle('faq', 'Ada yang ingin ditanyakan?')}</h2>
            <p>{getSectionSubtitle(
              'faq',
              'Jawaban singkat untuk hal-hal yang sering ditanyakan tentang perjalanan rilisan.',
            )}</p>
          </div>

          <div className="home-faq__content">
            <div className="home-faq__categories" aria-label="Kategori pertanyaan">
              {faqCategories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => setActiveFaqCatId(category.id)}
                  className={activeCategory?.id === category.id ? 'is-active' : ''}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {activeCategory?.description && (
              <p className="home-faq__description">{activeCategory.description}</p>
            )}

            <div className="home-faq__items">
              {(activeCategory?.items || []).map((faq) => {
                const isOpen = openFaqItems[faq.id] ?? false;
                return (
                  <article className={`home-faq__item ${isOpen ? 'is-open' : ''}`} key={faq.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqItems((current) => ({ ...current, [faq.id]: !isOpen }))}
                    >
                      <span>{faq.question}</span>
                      {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    </button>
                    {isOpen && <p>{faq.answer}</p>}
                  </article>
                );
              })}
              {(!activeCategory?.items || activeCategory.items.length === 0) && (
                <p className="home-faq__empty"><HelpCircle size={16} /> Belum ada pertanyaan di kategori ini.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {isSectionEnabled('cta') && (
        <section id="cta" className="home-last-call">
          <p className="home-eyebrow"><span /> Langkah berikutnya milikmu</p>
          <h2>{getSectionTitle('cta', 'Kalau lagunya sudah siap, ayo mulai.')}</h2>
          <p>{getSectionSubtitle(
            'cta',
            'Buat akun dan mulai siapkan ruang untuk rilisanmu.',
          )}</p>
          <Link to="/register" className="home-button home-button--lime">
            Buat akun <ArrowRight size={17} />
          </Link>
        </section>
      )}
    </div>
  );
}
