import { isIosNativeShell } from "@/lib/platform";

interface RestaurantGuideCardProps {
  className?: string;
}

export default function RestaurantGuideCard({ className = "" }: RestaurantGuideCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">Restaurant Guide</h3>
      <p className="text-sm opacity-90 mb-3">
        Find healthy meal options from local restaurants, tailored to your dietary needs and goals.
      </p>
      <div className="text-xs bg-amber-100 text-gray-800 px-2 py-1 rounded">
        {isIosNativeShell() ? "🔒 Unlock with Premium" : "🔒 Unlock with Premium Plan – $19.99/month"}
      </div>
    </div>
  );
}