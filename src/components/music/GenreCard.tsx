interface GenreCardProps {
  name: string;
  color: string;
  onClick?: () => void;
}

export default function GenreCard({ name, color, onClick }: GenreCardProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg p-3 hover:scale-105 transition-transform"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${adjustColorBrightness(color, -20)} 100%)`,
      }}
    >
      <h3 className="text-white font-bold text-xs">{name}</h3>
    </div>
  );
}

// Helper function to darken color
function adjustColorBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
