import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChefHat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isChefConversationEnabled } from "@/lib/chefCornerExperience";
import { chefMemberText } from "@/lib/chefMemberBranding";

interface CoachCornerStatus {
  completed: boolean;
}

export default function CoachCornerCard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation("coachCorner");

  const { data } = useQuery<CoachCornerStatus>({
    queryKey: ["/api/coach-corner/status"],
    staleTime: 60_000,
  });

  const completed = !!data?.completed;
  const destination = completed
    ? "/coach-corner/home"
    : "/coach-corner/welcome";

  return (
    isChefConversationEnabled() ? (
      <div className="mb-4 relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-2xl blur-md opacity-70"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, rgba(249,115,22,0.5), rgba(249,115,22,0.25), rgba(0,0,0,0))",
          }}
        />
        <div className="relative overflow-hidden rounded-2xl border border-orange-400/40 bg-gradient-to-br from-[#17110d] via-[#21150e] to-black shadow-[0_12px_36px_rgba(0,0,0,0.28)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-orange-300/10"
          />
          <div className="flex items-center gap-3 p-4 pb-3 sm:gap-4 sm:p-5">
            <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-orange-300/30 bg-black sm:h-20 sm:w-20">
              <img
                src="/assets/ask-chef-desk.webp"
                alt="Flame Chef"
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300/80">
                <ChefHat aria-hidden="true" className="h-3.5 w-3.5" />
                Your food &amp; platform guide
              </span>
              <h3 className="font-bold leading-none tracking-tight text-white">
                <img
                  src="/assets/ask-chef-wordmark.webp"
                  alt="Ask Chef"
                  width={600}
                  height={200}
                  className="h-[3.12rem] w-auto max-w-full object-contain object-left sm:h-[3.96rem]"
                />
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-orange-50/65 sm:text-sm">
                Ask about food, explore meal ideas, or find your way around My Perfect Meals.
              </p>
            </div>
          </div>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <button
              type="button"
              onClick={() => setLocation(destination)}
              className="w-full rounded-xl border border-orange-200/80 bg-gradient-to-r from-[#9a3412] via-[#c64f08] to-[#9a3412] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFFFFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_5px_rgba(0,0,0,0.22)] transition-all hover:border-orange-100 hover:from-[#7c2d12] hover:via-[#b84609] hover:to-[#7c2d12] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_8px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17110d] active:from-[#7c2d12] active:via-[#9a3412] active:to-[#7c2d12] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)]"
            >
              Open Ask Chef
            </button>
          </div>
        </div>
      </div>
    ) : (
      <div className="mb-4 relative">
        <div className="pointer-events-none absolute -inset-1 rounded-2xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(249,115,22,0.5), rgba(249,115,22,0.25), rgba(0,0,0,0))" }} />
        <div className="relative rounded-2xl border border-orange-400/30 bg-gradient-to-r from-black via-orange-950/30 to-black backdrop-blur-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-orange-500/20 border border-orange-400/40 flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5 text-orange-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">{chefMemberText(t("title"))}</h3>
              <p className="text-xs text-white/60">
                {completed
                  ? t("learningDesc")
                  : t("startDesc")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocation(destination)}
            className="w-full py-2.5 rounded-xl bg-black border-2 border-orange-600 text-white text-[11px] font-semibold uppercase tracking-wide transition-colors"
          >
            {chefMemberText(t("openBtn"))}
          </button>
        </div>
      </div>
    )
  );
}
