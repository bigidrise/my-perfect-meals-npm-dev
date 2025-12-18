interface CycleSyncingCardProps {
  className?: string;
}

export default function CycleSyncingCard({ className = "" }: CycleSyncingCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">🩸 Cycle Syncing</h3>
      <p className="text-sm opacity-90 mb-3">
        Align your meals, training, and recovery with your menstrual cycle. A feature built to help you work *with* your hormones, not against them.
      </p>
      <div className="text-xs bg-white/20 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}