import { Play, MoreVertical, Music } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  artwork?: string;
}

interface TopChartsProps {
  tracks: Track[];
  onPlayTrack?: (trackId: string) => void;
}

export default function TopCharts({ tracks, onPlayTrack }: TopChartsProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Top Charts</h2>
        <button className="text-xs text-gray-400 hover:text-white transition-colors">
          See all
        </button>
      </div>

      <div className="space-y-2">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {/* Rank */}
            <div className="text-gray-400 font-bold w-5 text-center text-xs">
              {String(index + 1).padStart(2, '0')}
            </div>

            {/* Artwork */}
            <div className="relative">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500">
                {track.artwork ? (
                  <img
                    src={track.artwork}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-white/50" />
                  </div>
                )}
              </div>
              <button
                onClick={() => onPlayTrack?.(track.id)}
                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
              >
                <Play className="w-4 h-4 text-white fill-current" />
              </button>
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium text-xs truncate">{track.title}</h4>
              <p className="text-gray-400 text-xs truncate">{track.artist}</p>
            </div>

            {/* Duration */}
            <div className="text-gray-400 text-xs">{track.duration}</div>

            {/* Actions */}
            <button className="p-1 hover:bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
