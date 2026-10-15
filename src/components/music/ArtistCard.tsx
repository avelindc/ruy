import { Music } from 'lucide-react';

interface ArtistCardProps {
  name: string;
  plays?: number;
  image?: string;
  onClick?: () => void;
}

export default function ArtistCard({ name, plays, image, onClick }: ArtistCardProps) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-gray-900 rounded-lg p-3 hover:bg-gray-800 transition-all hover:scale-105"
    >
      <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-8 h-8 text-white/50" />
          </div>
        )}
      </div>
      <h3 className="text-white font-semibold text-xs mb-1 truncate">{name}</h3>
      {plays !== undefined && (
        <p className="text-gray-400 text-xs">{plays.toLocaleString()} Plays</p>
      )}
    </div>
  );
}
