import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Maximize2,
  Mic2
} from 'lucide-react';

export interface CurrentTrackData {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
  audio_url?: string;
  audioUrl?: string;
}

interface MusicPlayerProps {
  currentTrack?: CurrentTrackData;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

const defaultTrack: CurrentTrackData = {
  title: '',
  artist: '',
  album: '',
  artwork: '',
  duration: 0,
};

export default function MusicPlayer({
  currentTrack = defaultTrack,
  isPlaying: externalIsPlaying,
  onPlayPause: externalOnPlayPause,
  onNext,
  onPrevious,
}: MusicPlayerProps) {
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const track = currentTrack || defaultTrack;
  const duration = track.duration || 0;

  useEffect(() => {
    let interval: any;
    if (isPlaying && duration > 0) {
      interval = setInterval(() => {
        setCurrentTime((prev) => (prev >= duration ? 0 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  const handleTogglePlay = () => {
    if (externalOnPlayPause) {
      externalOnPlayPause();
    } else {
      setInternalIsPlaying(!isPlaying);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const remainingTime = Math.max(0, duration - currentTime);
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  return (
    <div className="w-full h-full bg-[#121218] border border-white/[0.08] rounded-3xl p-6 shadow-2xl flex flex-col justify-between select-none text-white font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-base font-bold tracking-tight text-white">Player</h2>
        <button
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="Expand Player"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Center Artwork & Track Details */}
      <div className="flex-1 flex flex-col justify-center space-y-5 my-2">
        {/* Artwork Card matching reference image */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#181824] border border-white/[0.08] shadow-2xl relative group max-h-[300px] mx-auto">
          <img
            src={track.artwork || '/images/butterfly-effect.jpg'}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/butterfly-effect.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
        </div>

        {/* Track Title and Artist */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-extrabold text-white tracking-tight truncate px-2">
            {track.title}
          </h3>
          <p className="text-xs text-gray-400 font-medium truncate px-2">
            {track.artist}
            {track.album && <span className="text-gray-500"> • {track.album}</span>}
          </p>
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-2 pt-1">
          <div
            className="h-1.5 w-full bg-white/[0.12] rounded-full relative cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              setCurrentTime(Math.floor(clickPos * duration));
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Scrubber Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all"
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(remainingTime)}</span>
          </div>
        </div>
      </div>

      {/* VIBRANT BLUE CONTROLS CARD matching reference image */}
      <div className="bg-[#4F67FF] rounded-2xl p-4.5 shadow-[0_12px_28px_rgba(79,103,255,0.4)] flex flex-col items-center gap-3.5 text-white flex-shrink-0 mt-2">
        {/* Playback Controls Row */}
        <div className="w-full flex items-center justify-between px-3">
          <button
            onClick={() => setIsShuffle(!isShuffle)}
            className={`p-1.5 transition-transform hover:scale-110 ${
              isShuffle ? 'text-white' : 'text-white/70 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrevious}
            className="p-1.5 text-white hover:scale-110 transition-transform"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Large Circular Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            className="w-12 h-12 rounded-full bg-white text-[#4F67FF] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-[#4F67FF]" />
            ) : (
              <Play className="w-5 h-5 fill-current text-[#4F67FF] ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-1.5 text-white hover:scale-110 transition-transform"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => setIsRepeat(!isRepeat)}
            className={`p-1.5 transition-transform hover:scale-110 ${
              isRepeat ? 'text-white' : 'text-white/70 hover:text-white'
            }`}
            title="Repeat"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* LYRICS Button */}
        <button className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-white/90 hover:text-white transition-opacity">
          <Mic2 className="w-3.5 h-3.5" />
          <span>LYRICS</span>
        </button>
      </div>
    </div>
  );
}
