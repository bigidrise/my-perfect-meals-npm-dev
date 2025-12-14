import ComingSoonCard from "@/components/ComingSoonCard";

export default function ComingSoon({
  title,
  blurb,
  hint,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  blurb: string;
  hint?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-700 to-pink-900 p-6">
      <div className="max-w-2xl mx-auto mt-16">
        <ComingSoonCard
          title={title}
          blurb={blurb}
          hint={hint}
          ctaLabel={ctaLabel}
          ctaHref={ctaHref}
        />
      </div>
    </div>
  );
}