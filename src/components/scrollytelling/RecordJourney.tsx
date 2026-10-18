import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './RecordJourney.css';

const chapters = [
  {
    marker: 'SIDE A / 01',
    title: 'Semua berawal dari satu rilisan.',
    copy: 'Kumpulkan master, artwork, dan detail lagu. Pelan-pelan, semuanya punya tempat.',
  },
  {
    marker: 'SIDE A / 02',
    title: 'Rapikan sebelum dilepas.',
    copy: 'Periksa kembali informasi artis dan rilisanmu, lalu ikuti statusnya dari ruang kerja yang sama.',
  },
  {
    marker: 'SIDE B / 01',
    title: 'Biarkan ia menemukan pendengarnya.',
    copy: 'Siapkan perjalanan distribusimu dengan langkah yang jelas dan tetap dalam kendalimu.',
  },
  {
    marker: 'SIDE B / 02',
    title: 'Tetap dekat dengan hasilnya.',
    copy: 'Kembali untuk melihat katalog, laporan, transaksi, dan informasi yang tersedia di akunmu.',
  },
  {
    marker: 'OUTRO / YOUR MOVE',
    title: 'Sekarang, giliran lagumu.',
    copy: 'Mulai dari ruang kecil tempat lagu itu dibuat. Sisanya, kamu yang menentukan.',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function RecordJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeChapterRef = useRef(0);
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    let frame = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const section = sectionRef.current;
        const stage = stageRef.current;
        if (!section || !stage) return;

        const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
        const progress = clamp(-section.getBoundingClientRect().top / travel, 0, 1);
        const chapter = Math.min(chapters.length - 1, Math.floor(progress * chapters.length));

        if (chapter !== activeChapterRef.current) {
          activeChapterRef.current = chapter;
          setActiveChapter(chapter);
        }

        if (!reducedMotion) {
          stage.style.setProperty('--disc-x', `${-22 + progress * 150}px`);
          stage.style.setProperty('--disc-y', `${Math.sin(progress * Math.PI) * -14}px`);
          stage.style.setProperty('--disc-rotation', `${progress * 720}deg`);
          stage.style.setProperty('--disc-tilt', `${42 - progress * 22}deg`);
          stage.style.setProperty('--sleeve-x', `${28 - progress * 92}px`);
          stage.style.setProperty('--sleeve-tilt', `${-14 + progress * 27}deg`);
          stage.style.setProperty('--scene-tilt', `${8 - progress * 16}deg`);
          stage.style.setProperty('--orbit-scale', `${0.78 + progress * 0.54}`);
        }
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const goToChapter = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const travel = section.offsetHeight - window.innerHeight;
    const progress = index / chapters.length + 0.015;
    window.scrollTo({
      top: window.scrollY + section.getBoundingClientRect().top + travel * progress,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <section
      className="record-journey"
      id="perjalanan"
      ref={sectionRef}
      aria-label="Perjalanan rilisan Breakout Music"
    >
      <div className="record-stage" ref={stageRef} data-chapter={activeChapter}>
        <div className="record-stage__topline">
          <span>CARA KERJANYA</span>
          <span>PUTARAN {String(activeChapter + 1).padStart(2, '0')} / 05</span>
        </div>

        <div className="record-stage__layout">
          <div className="record-stage__story" aria-live="polite">
            <div className="record-stage__chapters">
              {chapters.map((chapter, index) => (
                <article
                  className={`record-chapter ${index === activeChapter ? 'is-active' : ''}`}
                  key={chapter.marker}
                  aria-hidden={index !== activeChapter}
                >
                  <p className="record-chapter__marker">{chapter.marker}</p>
                  <h2>{chapter.title}</h2>
                  <p className="record-chapter__copy">{chapter.copy}</p>
                  {index === chapters.length - 1 && (
                    <Link to="/register" className="record-chapter__cta">
                      Mulai siapkan rilisan <ArrowRight size={16} />
                    </Link>
                  )}
                </article>
              ))}
            </div>

            <div className="record-stage__navigation" aria-label="Pilih bagian cerita">
              {chapters.map((chapter, index) => (
                <button
                  key={chapter.marker}
                  type="button"
                  onClick={() => goToChapter(index)}
                  aria-label={`Ke bagian ${index + 1}: ${chapter.title}`}
                  aria-current={index === activeChapter ? 'step' : undefined}
                  className={index === activeChapter ? 'is-active' : ''}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              ))}
              <div className="record-stage__progress" aria-hidden="true">
                <span style={{ transform: `scaleY(${(activeChapter + 1) / chapters.length})` }} />
              </div>
            </div>
          </div>

          <div className="record-art" aria-hidden="true">
            <div className="record-art__orbit record-art__orbit--outer" />
            <div className="record-art__orbit record-art__orbit--inner" />
            <div className="record-art__ground" />
            <div className="record-sleeve">
              <div className="record-sleeve__photo" />
              <div className="record-sleeve__label">
                <span>BREAKOUT MUSIC</span>
                <strong>YOUR<br />SIDE A</strong>
                <small>INDEPENDENT / 001</small>
              </div>
              <div className="record-sleeve__spine">B / M — ORIGINALS</div>
            </div>
            <div className="record-disc">
              <div className="record-disc__grooves" />
              <div className="record-disc__label">
                <span>SIDE A</span>
                <strong>YOUR<br />MUSIC</strong>
                <small>33⅓ RPM · STEREO</small>
              </div>
              <span className="record-disc__hole" />
            </div>
            <div className="record-arm">
              <span className="record-arm__pivot" />
              <span className="record-arm__bar" />
              <span className="record-arm__needle" />
            </div>
            <div className="record-art__annotation record-art__annotation--top">
              <span>PRESS PLAY</span><i />
            </div>
            <div className="record-art__annotation record-art__annotation--bottom">
              <i /><span>MADE TO MOVE</span>
            </div>
          </div>
        </div>

        <div className="record-stage__footer">
          <span>MASTER / ARTWORK / METADATA</span>
          <span>SCROLL TO MOVE THE RECORD</span>
        </div>
      </div>
    </section>
  );
}
