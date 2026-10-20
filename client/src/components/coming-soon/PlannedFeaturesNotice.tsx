import { Link } from "wouter";
import { developmentComingSoonEnabled } from "@/lib/developmentComingSoon";

/** Separate from paid benefits: no tier assignment, purchase CTA or entitlement. */
export default function PlannedFeaturesNotice() {
  if (!developmentComingSoonEnabled) return null;
  return (
    <section
      aria-labelledby="planned-features-heading"
      data-testid="planned-features-notice"
      className="mb-6 rounded-xl border border-white/15 bg-black/30 p-4 text-white"
    >
      <h2 id="planned-features-heading" className="text-sm font-semibold">Planned features — not available yet</h2>
      <ul className="mt-3 space-y-2 text-sm text-white/80">
        <li>My Perfect Pregnancy — Coming Soon (Clinical)</li>
        <li>
          <Link className="text-orange-300 underline" href="/lifestyle/ai-pairing-advisor?from=pricing">
            AI Pairing Advisor — Coming Soon
          </Link>
        </li>
      </ul>
      <p className="mt-3 text-xs text-white/70">
        These planned features are not currently available subscription benefits.
        The existing Drink Pairing feature remains available on its current plan.
      </p>
    </section>
  );
}
