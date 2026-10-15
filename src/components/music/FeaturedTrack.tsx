import { Play, Heart } from 'lucide-react';

interface FeaturedTrackProps {
  title: string;
  artist: string;
  plays: number;
  artwork?: string;
  onPlay?: () => void;
  onFavorite?: () => void;
}

export default function FeaturedTrack({
  title,
  artist,
  plays,
  artwork,
  onPlay,
  onFavorite,
}: FeaturedTrackProps) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-800">
      <div className="flex items-center h-64 gap-8 px-8 py-6 bg-gradient-to-r from-gray-900 via-purple-900/30 to-transparent">
        {/* Left Side - Track Info */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-xs text-gray-400 mb-3 uppercase font-bold tracking-wider">Trending New Hits</p>
          <h1 className="text-5xl font-bold text-white mb-3 leading-tight max-w-md">
            {title}
          </h1>
          <div className="mb-6 space-y-1">
            <p className="text-gray-300 text-base">{artist}</p>
            <p className="text-gray-500 text-sm">{plays.toLocaleString()} Plays</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={onPlay}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-2.5 rounded-full font-bold transition-colors text-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Listen Now</span>
            </button>
            <button
              onClick={onFavorite}
              className="p-2.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full transition-colors"
            >
              <Heart className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Side - Artwork */}
        <div className="flex-shrink-0 w-56 h-56 rounded-lg overflow-hidden shadow-2xl">
          {artwork ? (
            <img
              src={artwork}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <span className="text-7xl opacity-30">♪</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
