import { isIosNativeShell } from "@/lib/platform";

interface FridgeRescueCardProps {
  className?: string;
}

export default function FridgeRescueCard({ className = "" }: FridgeRescueCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">Fridge Rescue</h3>
      <p className="text-sm opacity-90 mb-3">
        Don't know what to cook? Tell us what's in your fridge, and we'll help you make a meal fast.
      </p>
      <div className="text-xs bg-amber-100 text-gray-800 px-2 py-1 rounded">
        {isIosNativeShell() ? "🔒 Unlock with Premium" : "🔒 Unlock with Upgrade Plan – $19.99/month"}
      </div>
    </div>
  );
}