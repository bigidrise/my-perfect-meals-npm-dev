import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PillButton } from "@/components/ui/pill-button";
import { ChefHat } from "lucide-react";

interface CoachCornerStatus {
  completed: boolean;
}

export default function CoachCornerCard() {
  const [, setLocation] = useLocation();

  const { data } = useQuery<CoachCornerStatus>({
    queryKey: ["/api/coach-corner/status"],
    staleTime: 60_000,
  });

  const completed = !!data?.completed;

  return (
    <div className="mb-4 rounded-2xl border border-orange-400/20 bg-gradient-to-r from-black/60 via-orange-600/20 to-black/60 backdrop-blur-sm p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-orange-500/20 border border-orange-400/40 flex items-center justify-center shrink-0">
          <ChefHat className="w-5 h-5 text-orange-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Coach's Corner</h3>
          <p className="text-xs text-white/60">
            {completed
              ? "Chef is learning what works for you."
              : "Start your AI coaching relationship with Chef."}
          </p>
        </div>
      </div>
      <PillButton
        active
        onClick={() =>
          setLocation(
            completed ? "/coach-corner/home" : "/coach-corner/welcome"
          )
        }
        className="w-full !text-[11px] !py-2.5 !rounded-xl"
      >
        {completed ? "Open Coach's Corner" : "Open Coach's Corner"}
      </PillButton>
    </div>
  );
}
