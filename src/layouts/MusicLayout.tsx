import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react';
import MusicSidebar from '@components/music/MusicSidebar';
import MusicHeader from '@components/music/MusicHeader';
import { CurrentTrackData } from '@components/music/MusicPlayer';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { useAuth } from '@contexts/AuthContext';

export default function MusicLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackError, setPlaybackError] = useState('');

  const [currentTrack, setCurrentTrack] = useState<CurrentTrackData>({
    title: 'Pilih Lagu dari Katalog',
    artist: 'Breakout Music Player',
    album: 'Koleksi Musik',
    artwork: '',
    duration: 0,
    audioUrl: '',
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const currentUserName = user?.fullName || user?.email?.split('@')[0] || '—';

  useEffect(() => {
    const handleTrackChange = (e: any) => {
      if (e.detail) {
        const rawAudio = e.detail.audio_url || e.detail.audioUrl || '';
        const resolvedAudio = resolveMediaUrl(rawAudio);
        const resolvedArtwork = resolveMediaUrl(e.detail.artwork || e.detail.cover_url || '');

        setCurrentTrack({
          ...e.detail,
          artwork: resolvedArtwork,
          audioUrl: resolvedAudio,
        });
        setPlaybackError('');
        setCurrentTime(0);

        if (audioRef.current) {
          if (resolvedAudio) {
            audioRef.current.src = resolvedAudio;
            audioRef.current.load();
            audioRef.current.play()
              .then(() => setIsPlaying(true))
              .catch((err) => {
                console.warn('Audio auto-play prevented or stream failed:', err);
                setIsPlaying(false);
                // Safari or user gesture policy
                if (err.name === 'NotAllowedError') {
                  setPlaybackError('Tekan Play untuk memutar audio');
                } else {
                  setPlaybackError('Format audio tidak dapat diputar atau file tidak ditemukan.');
                }
              });
          } else {
            setIsPlaying(false);
            setPlaybackError('File audio master belum diunggah untuk lagu ini.');
          }
        }
      }
    };

    window.addEventListener('groovvy-play-track', handleTrackChange);
    return () => window.removeEventListener('groovvy-play-track', handleTrackChange);
  }, []);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setPlaybackError('');
      if (!audioRef.current.src || audioRef.current.src === window.location.href) {
        if (currentTrack.audioUrl) {
          audioRef.current.src = currentTrack.audioUrl;
        }
      }
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
          setPlaybackError('Gagal memutar audio: ' + (err.message || 'Stream terputus'));
        });
    }
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle custom mobile menu toggle event from overview header
  useEffect(() => {
    const handleToggle = () => setMobileMenuOpen(prev => !prev);
    window.addEventListener('toggle-mobile-menu', handleToggle);
    return () => window.removeEventListener('toggle-mobile-menu', handleToggle);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalDuration = audioDuration || currentTrack.duration || 210;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / (totalDuration || 1)) * 100));
  const isOverview = location.pathname === '/dashboard';

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * totalDuration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  return (
    <div className="h-screen w-full max-w-full bg-[#131417] text-white overflow-hidden flex flex-row font-sans relative">
      {/* Hidden Native Audio Element for Real Playback */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setAudioDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('HTMLAudioElement error:', e);
          setIsPlaying(false);
          setPlaybackError('Gagal memutar audio: format tidak didukung atau file tidak ditemukan di storage.');
        }}
      />

      {/* 1. Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. Left Sidebar (Fixed on Desktop, Drawer on Mobile) */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-20 h-full w-[250px] flex-shrink-0 transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <MusicSidebar />
      </aside>

      {/* 3. Main Workspace Area (Uses the Entire Remaining Screen Width) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#131417]">
        {/* Top Header (only on non-overview pages; Overview has its dedicated Purse-style header) */}
        {!isOverview && (
          <MusicHeader
            userName={currentUserName}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
        )}

        {/* Scrollable Center Content with full width usage */}
        <main className={`flex-1 overflow-y-auto ${isOverview ? 'px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6' : 'px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8'} custom-scrollbar`}>
          <div className="max-w-[1600px] mx-auto w-full pb-24 min-w-0">
            <Outlet />
          </div>
        </main>

        {/* Playback Error Toast if stream failed */}
        {playbackError && (
          <div className="bg-rose-500/15 border-t border-rose-500/30 px-4 py-2 text-rose-300 text-xs flex items-center justify-between gap-3 z-30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{playbackError}</span>
            </div>
            <button
              onClick={() => setPlaybackError('')}
              className="text-rose-400 hover:text-white text-xs underline"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Persistent Bottom Audio Player Bar */}
        <div className="bg-[#121218]/95 backdrop-blur-md border-t border-white/[0.08] px-4 py-3 sm:px-8 flex items-center justify-between gap-4 z-30 flex-shrink-0">
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 min-w-0 max-w-xs sm:max-w-sm">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 relative border border-white/[0.08] shadow-md">
              <img
                src={currentTrack.artwork || '/images/butterfly-effect.jpg'}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/butterfly-effect.jpg';
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white truncate">{currentTrack.title}</p>
              <p className="text-[11px] text-gray-400 truncate">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Center: Playback Controls & Progress Bar */}
          <div className="flex-1 max-w-lg hidden sm:flex flex-col items-center gap-1.5 px-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-9 h-9 rounded-full bg-[#4F67FF] hover:bg-[#435BFF] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current pointer-events-none" /> : <Play className="w-4 h-4 fill-current ml-0.5 pointer-events-none" />}
              </button>
            </div>

            <div className="w-full flex items-center gap-2 text-[10px] text-gray-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <div
                onClick={handleSeek}
                className="flex-1 h-2 bg-white/[0.1] hover:bg-white/[0.15] rounded-full overflow-hidden cursor-pointer flex items-center"
                title="Geser / Klik untuk lompat waktu"
              >
                <div
                  className="h-full bg-[#4F67FF] rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Right: Status Info */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={togglePlayPause}
              className="sm:hidden w-8 h-8 rounded-full bg-[#4F67FF] text-white flex items-center justify-center cursor-pointer touch-manipulation"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current pointer-events-none" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5 pointer-events-none" />}
            </button>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span>{isPlaying ? 'Memutar Audio Master' : 'Breakout Master Audio'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
