import { Link } from "wouter";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

type ComingSoonPresentationProps = {
  title: string;
  description: string;
  headerLabel: string;
  backHref: string;
  backLabel: string;
  testId: string;
  tone?: "pink" | "orange";
};

export default function ComingSoonPresentation({
  title, description, headerLabel, backHref, backLabel, testId, tone = "pink",
}: ComingSoonPresentationProps) {
  const divider = tone === "orange" ? "border-orange-500/20" : "border-pink-500/20";
  const badge = tone === "orange" ? "text-orange-300" : "text-pink-300";
  return (
    <section className="text-white" data-testid={testId}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <MobileHeaderGuard>
        <div aria-label={`${headerLabel} page header`}
          className={`border-b ${divider} bg-black/80 px-4 py-3`}>
          <span className="text-sm font-semibold">My Perfect Meals</span>
          <span className="ml-2 text-xs">{headerLabel}</span>
          <span className={`ml-2 text-xs ${badge}`}>Coming Soon</span>
        </div>
      </MobileHeaderGuard>
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-4">{description}</p>
        <Link className="mt-6 inline-block underline" href={backHref}>{backLabel}</Link>
      </div>
    </section>
  );
}
