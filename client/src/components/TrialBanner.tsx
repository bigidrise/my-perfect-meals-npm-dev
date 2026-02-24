import { useAuth } from "@/contexts/AuthContext";

export function TrialBanner() {
  const { user } = useAuth();

  if (!user || user.accessTier !== "TRIAL_FULL") return null;

  const daysRemaining = user.trialDaysRemaining ?? 0;
  const isUrgent = daysRemaining <= 1;

  return (
    <div
      className={`w-full px-4 py-2 text-center text-sm font-medium ${
        isUrgent
          ? "bg-orange-600/90 text-white"
          : "bg-gradient-to-r from-emerald-600/80 to-teal-600/80 text-white"
      }`}
    >
      Full Access Preview &middot;{" "}
      {daysRemaining === 0
        ? "Less than 1 day remaining"
        : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
    </div>
  );
}
