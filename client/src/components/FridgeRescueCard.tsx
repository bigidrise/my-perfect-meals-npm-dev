import { isIosNativeShell } from "@/lib/platform";

interface FridgeRescueCardProps {
  className?: string;
}

export default function FridgeRescueCard({
  className = "",
}: FridgeRescueCardProps) {
  return (
    <div
      className={`p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg text-white ${className}`}
    >
      <h3 className="text-lg font-semibold mb-2">Fridge Rescue</h3>

      <p className="text-sm opacity-90 mb-3">
        Tell Chef what ingredients you have and get a meal idea instantly.
      </p>

      <ul className="text-xs opacity-90 space-y-1 mb-3">
        <li>• Free users get limited Fridge Rescue per week</li>
        <li>• Essential unlocks unlimited meal generation</li>
      </ul>

      <div className="text-xs bg-amber-100 text-gray-800 px-2 py-1 rounded">
        {isIosNativeShell()
          ? "Upgrade for unlimited Fridge Rescue meals"
          : "Upgrade to unlock unlimited Fridge Rescue – $19.99/month"}
      </div>
    </div>
  );
}
