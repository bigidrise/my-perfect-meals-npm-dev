import ThinkingDots from "@/components/ThinkingDots";

export function CreatorMenuRestorationProgress() {
  return (
    <div className="mt-8 flex min-h-32 items-center justify-center" role="status" aria-live="polite" aria-label="Loading your ideas">
      <ThinkingDots label="Loading your ideas" />
    </div>
  );
}