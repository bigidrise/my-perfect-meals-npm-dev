interface AthleteModeCardProps {
  className?: string;
}

export default function AthleteModeCard({ className = "" }: AthleteModeCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">🏋️ Athlete Mode</h3>
      <p className="text-sm opacity-90 mb-3">
        Designed for bodybuilders, fighters, performance athletes, and competitors who need precise control over their nutrition, goals, and macros.
      </p>
      <div className="text-xs bg-white/20 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}