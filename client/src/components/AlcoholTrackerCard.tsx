interface AlcoholTrackerCardProps {
  className?: string;
}

export default function AlcoholTrackerCard({ className = "" }: AlcoholTrackerCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">🍷 Alcohol & Lifestyle</h3>
      <p className="text-sm opacity-90 mb-3">
        Drinking doesn't have to derail your goals. Log it. Learn from it. Adjust when you need to.
      </p>
      <div className="text-xs bg-white/20 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}