import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { CmsScrollytelling, CmsScrollytellingStep } from '../../services/cmsService';

interface ScrollytellingCanvasProps {
  config?: CmsScrollytelling | null;
  /** Optional preview mode inside CMS admin */
  isPreview?: boolean;
  /** Optional controlled progress in preview mode (0 to 1) */
  previewProgress?: number;
}

const DEFAULT_CONFIG: CmsScrollytelling = {
  id: 'main',
  is_enabled: true,
  status: 'published',
  bg_color: '#0B0B0E',
  scroll_height_vh: 400,
  canvas_aspect_ratio: '16/9',
  cta_label: 'Mulai Rilis Lagu Gratis',
  cta_url: '/register',
  text_steps: [
    {
      step_index: 0,
      badge: '0% • HEADLINE UTAMA',
      title: 'Engine Distribusi Presisi Breakout Music',
      description:
        'Infrastruktur komputasi presisi tinggi yang menggerakkan katalog musik Anda ke seluruh penjuru dunia dengan transparansi total.',
      alignment: 'center',
      start_progress: 0,
      end_progress: 25,
      is_active: true,
    },
    {
      step_index: 1,
      badge: '30% • FITUR PERTAMA',
      title: 'Perlindungan Audio & CTM Realtime',
      description:
        'Deteksi instan di YouTube Content ID, TikTok, dan Meta Reels. Setiap detik karya Anda diputar, royalti terlacak akurat tanpa celah.',
      alignment: 'left',
      start_progress: 26,
      end_progress: 55,
      is_active: true,
    },
    {
      step_index: 2,
      badge: '60% • FITUR KEDUA',
      title: 'Pipeline Distribusi ke 150+ Layanan Streaming',
      description:
        'Pengiriman kilat ke Spotify, Apple Music, TikTok, dan YouTube Music dengan integritas metadata utuh dan kualitas audio lossless.',
      alignment: 'right',
      start_progress: 56,
      end_progress: 85,
      is_active: true,
    },
    {
      step_index: 3,
      badge: '90% • PESAN FINAL & CTA',
      title: 'Kendalikan Masa Depan Musikmu',
      description:
        'Pertahankan 100% kepemilikan master lagu, nikmati pencairan royalti instan ke rekening lokal, dan raih jutaan pendengar global.',
      alignment: 'center',
      start_progress: 86,
      end_progress: 100,
      is_active: true,
    },
  ],
  frames: Array.from({ length: 40 }, (_, i) => ({
    id: `frame-${String(i + 1).padStart(3, '0')}`,
    scrollytelling_id: 'main',
    frame_index: i,
    frame_url: `/scroll-frames/ezgif-frame-${String(i + 1).padStart(3, '0')}.jpg`,
  })),
};

export const ScrollytellingCanvas: React.FC<ScrollytellingCanvasProps> = ({
  config = DEFAULT_CONFIG,
  isPreview = false,
  previewProgress,
}) => {
  const currentConfig = config || DEFAULT_CONFIG;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const [imagesLoadedCount, setImagesLoadedCount] = useState<number>(0);
  const [isInitialReady, setIsInitialReady] = useState<boolean>(false);

  // Loaded HTMLImageElements cache
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const animationFrameId = useRef<number | null>(null);

  const frames = (currentConfig.frames && currentConfig.frames.length > 0)
    ? [...currentConfig.frames].sort((a, b) => a.frame_index - b.frame_index)
    : DEFAULT_CONFIG.frames;

  const totalFrames = frames.length;

  // Eager preloading of all frames in parallel
  useEffect(() => {
    let isCancelled = false;
    imagesRef.current.clear();
    setImagesLoadedCount(0);
    setIsInitialReady(false);

    if (totalFrames === 0) return;

    let loaded = 0;

    frames.forEach((frame, idx) => {
      const img = new Image();
      img.src = frame.frame_url;

      img.onload = () => {
        if (!isCancelled) {
          imagesRef.current.set(idx, img);
          loaded++;
          setImagesLoadedCount(loaded);
          if (idx === 0 || loaded >= Math.min(3, totalFrames)) {
            setIsInitialReady(true);
          }
        }
      };

      img.onerror = () => {
        if (!isCancelled) {
          loaded++;
          setImagesLoadedCount(loaded);
          if (loaded >= Math.min(3, totalFrames)) {
            setIsInitialReady(true);
          }
        }
      };
    });

    return () => {
      isCancelled = true;
    };
  }, [totalFrames, currentConfig.id]);

  // Canvas drawing function with Contain Fit and High DPI sharpness
  const renderFrameToCanvas = useCallback(
    (frameIndex: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Find best available frame (exact, or nearest loaded fallback)
      let img = imagesRef.current.get(frameIndex);
      if (!img || !img.complete || img.naturalWidth === 0) {
        // Find nearest loaded frame
        for (let offset = 1; offset < totalFrames; offset++) {
          const prevImg = imagesRef.current.get(frameIndex - offset);
          if (prevImg && prevImg.complete && prevImg.naturalWidth > 0) {
            img = prevImg;
            break;
          }
          const nextImg = imagesRef.current.get(frameIndex + offset);
          if (nextImg && nextImg.complete && nextImg.naturalWidth > 0) {
            img = nextImg;
            break;
          }
        }
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(rect.width * dpr);
      const targetHeight = Math.round(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      // Background fill
      ctx.fillStyle = currentConfig.bg_color || '#0B0B0E';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!img || !img.complete || img.naturalWidth === 0) {
        return;
      }

      // Mode: Contain (preserve image aspect ratio, no cropping)
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = canvas.width / canvas.height;

      let drawW: number;
      let drawH: number;

      if (canvasAspect > imgAspect) {
        // Canvas is wider than image
        drawH = canvas.height;
        drawW = drawH * imgAspect;
      } else {
        // Canvas is taller than image
        drawW = canvas.width;
        drawH = drawW / imgAspect;
      }

      const drawX = (canvas.width - drawW) / 2;
      const drawY = (canvas.height - drawH) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    },
    [currentConfig.bg_color, totalFrames]
  );

  // Trigger draw when progress updates
  useEffect(() => {
    if (totalFrames === 0) return;

    // Direct mapping from progress (0 to 1) to frame index (0 to totalFrames - 1)
    const frameIdx = Math.max(
      0,
      Math.min(totalFrames - 1, Math.round(currentProgress * (totalFrames - 1)))
    );

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    animationFrameId.current = requestAnimationFrame(() => {
      renderFrameToCanvas(frameIdx);
    });

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [currentProgress, isInitialReady, imagesLoadedCount, renderFrameToCanvas, totalFrames]);

  // Window resize handler to redraw canvas
  useEffect(() => {
    const handleResize = () => {
      const frameIdx = Math.max(0, Math.min(totalFrames - 1, Math.round(currentProgress * (totalFrames - 1))));
      renderFrameToCanvas(frameIdx);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentProgress, totalFrames, renderFrameToCanvas]);

  // Active scroll listener on window
  useEffect(() => {
    if (isPreview) {
      if (typeof previewProgress === 'number') {
        setCurrentProgress(Math.max(0, Math.min(1, previewProgress)));
      }
      return;
    }

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollableHeight = rect.height - viewportHeight;

      if (scrollableHeight <= 0) return;

      // When the top of container is at or above top of viewport:
      // rect.top <= 0, so scrolled >= 0
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));
      setCurrentProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll(); // Initial evaluation

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isPreview, previewProgress]);

  // Helper for step opacity and transform based on scroll progress percentage
  const getStepVisualState = (step: CmsScrollytellingStep) => {
    const progPercent = currentProgress * 100;
    const { start_progress, end_progress } = step;

    // Buffer ramp for ultra smooth fade in / fade out (5% range)
    const ramp = 5;

    if (progPercent < start_progress - ramp || progPercent > end_progress + ramp) {
      return {
        opacity: 0,
        translateY: progPercent < start_progress ? 30 : -30,
        pointerEvents: 'none' as const,
        isVisible: false,
      };
    }

    let opacity = 1;
    let translateY = 0;

    if (progPercent < start_progress) {
      // Entering from bottom
      const t = (progPercent - (start_progress - ramp)) / ramp;
      opacity = Math.max(0, Math.min(1, t));
      translateY = (1 - t) * 30;
    } else if (progPercent > end_progress) {
      // Exiting to top
      const t = (progPercent - end_progress) / ramp;
      opacity = Math.max(0, Math.min(1, 1 - t));
      translateY = -t * 30;
    }

    return {
      opacity,
      translateY,
      pointerEvents: opacity > 0.1 ? ('auto' as const) : ('none' as const),
      isVisible: opacity > 0.05,
    };
  };

  const currentFrameIndex = Math.max(
    0,
    Math.min(totalFrames - 1, Math.round(currentProgress * (totalFrames - 1)))
  );

  return (
    <div
      ref={containerRef}
      id="scrollytelling-section"
      className="relative w-full"
      style={{
        backgroundColor: currentConfig.bg_color || '#0B0B0E',
        height: isPreview ? '100%' : `${currentConfig.scroll_height_vh || 400}vh`,
      }}
    >
      {/* Sticky Viewport Container */}
      <div
        className={`${
          isPreview ? 'relative h-[540px]' : 'sticky top-0 h-screen'
        } w-full overflow-hidden flex items-center justify-center select-none z-10`}
        style={{ backgroundColor: currentConfig.bg_color || '#0B0B0E' }}
      >
        {/* Canvas Layer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {/* Ambient subtle vignette overlay to blend edges seamlessly */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0B0B0E]/60 via-transparent to-[#0B0B0E]/60" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0B0B0E]/40 via-transparent to-[#0B0B0E]/40" />

        {/* Loading Indicator for initial frame batch */}
        {!isInitialReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0B0E]/90 z-20 backdrop-blur-md">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-lime-400/20 animate-ping" />
              <div className="w-16 h-16 rounded-full border-2 border-lime-400 border-t-transparent animate-spin flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-lime-400" />
              </div>
            </div>
            <p className="text-white font-medium text-sm tracking-wide">
              Menyiapkan Visual Engine...
            </p>
            <div className="w-48 h-1.5 bg-neutral-800 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-lime-400 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(100, (imagesLoadedCount / Math.max(1, totalFrames)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Story Text Overlays */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pointer-events-none">
          {currentConfig.text_steps
            .filter((s) => s.is_active)
            .map((step) => {
              const { opacity, translateY, pointerEvents, isVisible } = getStepVisualState(step);
              if (!isVisible) return null;

              // Alignment styling
              let alignClass = 'items-center text-center mx-auto max-w-2xl';
              let justifyClass = 'justify-center';
              if (step.alignment === 'left') {
                alignClass = 'items-start text-left mr-auto max-w-lg lg:max-w-xl';
                justifyClass = 'justify-start';
              } else if (step.alignment === 'right') {
                alignClass = 'items-end text-right ml-auto max-w-lg lg:max-w-xl';
                justifyClass = 'justify-end';
              }

              const isCtaStep = step.end_progress >= 95;

              return (
                <div
                  key={step.step_index}
                  className={`absolute inset-x-0 -translate-y-1/2 top-1/2 flex ${justifyClass} transition-all duration-150 ease-out`}
                  style={{
                    opacity,
                    transform: `translateY(calc(-50% + ${translateY}px))`,
                    pointerEvents,
                  }}
                >
                  <div
                    className={`flex flex-col ${alignClass} bg-[#0e0e14]/75 backdrop-blur-xl border border-white/10 p-6 sm:p-8 lg:p-10 rounded-3xl shadow-2xl shadow-black/80 ring-1 ring-white/5`}
                  >
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-lime-400/10 border border-lime-400/30 text-lime-400 text-xs font-semibold tracking-wider uppercase mb-3">
                      <Sparkles className="w-3.5 h-3.5" />
                      {step.badge}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
                      {step.title}
                    </h2>

                    {/* Description */}
                    <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                      {step.description}
                    </p>

                    {/* CTA Button on final step */}
                    {isCtaStep && (
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <a
                          href={currentConfig.cta_url || '/register'}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-neutral-950 font-bold text-sm shadow-lg shadow-lime-400/20 hover:shadow-lime-400/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <span>{currentConfig.cta_label || 'Mulai Rilis Lagu Gratis'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>
                        <a
                          href="#fitur"
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm border border-white/10 transition-colors"
                        >
                          Pelajari Fitur
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Frame Scrubber & Progress Indicator */}
        <div className="absolute bottom-6 inset-x-0 z-10 flex items-center justify-between px-8 max-w-7xl mx-auto pointer-events-none">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-mono text-neutral-400">
            <span className="inline-block w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            <span>
              FRAME {String(currentFrameIndex + 1).padStart(2, '0')} / {totalFrames}
            </span>
            <span className="text-neutral-600">•</span>
            <span className="text-lime-400 font-bold">
              {Math.round(currentProgress * 100)}%
            </span>
          </div>

          {/* Progress Bar Line */}
          <div className="hidden sm:flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <span className="text-[11px] font-mono text-neutral-400 tracking-wider">
              SCROLL ENGINE
            </span>
            <div className="w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-lime-400 rounded-full transition-all duration-75"
                style={{ width: `${currentProgress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
