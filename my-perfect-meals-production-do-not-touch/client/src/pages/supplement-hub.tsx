import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowUp, ArrowLeft, Info, Crown} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ---- LIVE PARTNER (Nutritional Frontiers) ----
const AFFILIATE = {
  id: "primary",
  name: "Nutritional Frontiers",
  tagline: "Clinician-grade nutraceuticals with practitioner resources",
  storeUrl: "https://nutritionalfrontiers.com/",
  heroImage: "/images/nf-hero.jpg",
  signupCtaLabel: "Join the VIP List",
  signupUrl: "https://example.com/vip-signup",
  highlights: [
    "Therapeutic dosing & transparent labels",
    "Clinical resources for healthcare practices",
    "3rd-party tested; cGMP/NSF manufacturing partners",
  ],
  // Member discount code
  discountCode: "31878",
  discountInstructions: "Register as a patient and use code 31878",
  // Category lane (shown as badges)
  categoryBadges: [
    "Practitioner-grade Nutraceuticals",
    "Homeopathy-friendly education",
  ],
};

// ---- COMING SOON PARTNER (Sports Nutrition lane) ----
const RCSS_COMING_SOON = {
  name: "Ronnie Coleman Signature Series",
  tagline: "Gym-proven sports nutrition from an 8× Mr. Olympia",
  siteUrl: "https://ronniecoleman.net/",
  // Short bullets — built to contrast the NF lane
  highlights: [
    "Sports Nutrition: Pre-Workout, Protein, BCAAs",
    "Performance & gym-culture branding",
    "cGMP/NSF-aligned manufacturing claims",
  ],
  categoryBadges: ["Sports Nutrition"],
};

// If you want more future partners later, push to this array
const FUTURE_PARTNERS = [RCSS_COMING_SOON];

// ---- Small UI shells ----
const CardShell: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className = "",
}) => (
  <div
    className={`w-full rounded-2xl shadow-lg bg-black/30 backdrop-blur-lg border border-white/20 ${className}`}
  >
    {children}
  </div>
);

const SectionTitle: React.FC<React.PropsWithChildren> = ({ children }) => (
  <h2 className="text-xl font-semibold tracking-tight text-white">
    {children}
  </h2>
);

const Pill: React.FC<React.PropsWithChildren<{ tone?: "default" | "red" }>> = ({
  children,
  tone = "default",
}) => (
  <span
    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold shadow-lg ${
      tone === "red"
        ? "bg-red-600 text-white border-2 border-red-400"
        : "bg-black/40 text-white border-2 border-white/40 backdrop-blur-lg"
    }`}
  >
    {children}
  </span>
);

const HeroImage: React.FC<{ url: string; alt?: string }> = ({
  url,
  alt = "Supplement partner",
}) => (
  <div className="w-full rounded-xl overflow-hidden border border-white/20 bg-black/20 backdrop-blur-lg">
    <img src={url} alt={alt} className="w-full h-auto object-cover" />
  </div>
);

export default function SupplementHub() {
  const [, setLocation] = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Supplement Hub | My Perfect Meals";
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
          <div className="px-8 py-3 flex items-center gap-3">
            <Crown className="h-6 w-6 text-orange-500" />
          

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Supplement Hub</h1>
        </div>
      </div>

      <main
        className="mx-auto max-w-screen-md px-4 pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Live Partner: Nutritional Frontiers (Nutraceuticals / Homeopathy-friendly) */}
        <CardShell className="p-6 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {AFFILIATE.name}
              </h3>
              <p className="text-sm text-white/70">{AFFILIATE.tagline}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {AFFILIATE.categoryBadges.map((b) => (
                  <span
                    key={b}
                    className="text-[11px] px-2 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-50"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <Pill>🏆 Official Partner</Pill>
          </div>

          <div className="mt-4 grid gap-4">
            <HeroImage
              url={AFFILIATE.heroImage}
              alt={`${AFFILIATE.name} overview`}
            />

            {/* Discount / access */}
            <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">
                🎯 Member Access Code
              </h4>
              <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-lg p-3 mb-2">
                <p className="text-lg font-mono font-bold text-white text-center tracking-wider">
                  {AFFILIATE.discountCode}
                </p>
              </div>
              <p className="text-sm text-white/90">
                {AFFILIATE.discountInstructions}
              </p>
            </div>

            <ul className="grid gap-2">
              {AFFILIATE.highlights.map((h, i) => (
                <li key={i} className="text-sm text-white/80">
                  • {h}
                </li>
              ))}
            </ul>

            <div className="grid gap-3 sm:flex sm:gap-3">
              <a
                href={AFFILIATE.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold bg-black/30 backdrop-blur-lg border border-white/20 text-white hover:bg-black/40 transition-all duration-200"
              >
                Shop Now
              </a>

              {AFFILIATE.signupUrl && (
                <a
                  href={AFFILIATE.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold bg-black/30 backdrop-blur-lg border border-white/20 text-white hover:bg-black/40 transition-all duration-200"
                >
                  {AFFILIATE.signupCtaLabel || "Sign Up"}
                </a>
              )}
            </div>

            {/* Tiny transparency about the lane */}
            <div className="text-[11px] text-white/70">
              Lane:{" "}
              <span className="font-semibold">
                Clinician-grade Nutraceuticals
              </span>{" "}
              with practitioner/clinic resources; we also feature education
              partners (incl. homeopathy).
            </div>
          </div>
        </CardShell>

        {/* Coming Soon / Future Partners */}
        <section className="space-y-4">
          <SectionTitle>More Partners</SectionTitle>
          <p className="text-sm text-white/70">
            We're expanding carefully. Expect a few more trusted brands here
            soon.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {FUTURE_PARTNERS.map((p, idx) => (
              <CardShell key={idx} className="p-4 relative">
                {/* Ribbon */}
                <div className="absolute bottom-3 right-3">
                  <Pill tone="red">COMING SOON</Pill>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-white">{p.name}</h4>
                    <p className="text-sm text-white/70">{p.tagline}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.categoryBadges.map((b: string) => (
                        <span
                          key={b}
                          className="text-[11px] px-2 py-1 rounded-full bg-indigo-400/20 border border-indigo-300/30 text-indigo-50"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <ul className="mt-3 grid gap-1">
                  {p.highlights.map((h: string, i: number) => (
                    <li key={i} className="text-sm text-white/75">
                      • {h}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 text-[11px] text-white/60">
                  Not the same lane as Nutritional Frontiers — this brand is{" "}
                  <span className="font-semibold">Sports Nutrition</span>.
                </div>

                <div className="mt-3">
                  <a
                    href={p.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                  >
                    Brand Website
                  </a>
                </div>
              </CardShell>
            ))}
          </div>
        </section>

        {/* Compliance / Transparency */}
        <section className="mt-8">
          <CardShell className="p-4">
            <h3 className="text-sm font-semibold mb-2 text-white">
              Transparency Note
            </h3>
            <p className="text-xs text-white/70">
              Some links are affiliate links. If you purchase through them, My
              Perfect Meals may earn a commission at no extra cost to you. We
              only recommend products Coach uses with clients.
            </p>
          </CardShell>
        </section>
      </main>
    </div>
  );
}
