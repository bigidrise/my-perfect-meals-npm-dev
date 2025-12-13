interface HolidayFeastCardProps {
  className?: string;
}

export default function HolidayFeastCard({ className = "" }: HolidayFeastCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">🎄 Holiday Feast Mode</h3>
      <p className="text-sm opacity-90 mb-3">
        Healthy holiday meals without the food coma. Plan festive dishes for Thanksgiving, Christmas, and more—guilt-free.
      </p>
      <div className="text-xs bg-white/20 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}