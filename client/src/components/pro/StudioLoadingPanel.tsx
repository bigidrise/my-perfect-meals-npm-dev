type StudioLoadingPanelProps = {
  kind?: "loading" | "error" | "denied";
  title?: string;
  detail?: string;
};

const panelCopy = {
  loading: {
    title: "Loading Studio",
    detail: "Preparing your workspace…",
  },
  error: {
    title: "Studio is unavailable",
    detail: "Something went wrong while loading this workspace.",
  },
  denied: {
    title: "Studio access is unavailable",
    detail: "You don’t currently have access to this workspace.",
  },
};

export function StudioLoadingPanel({
  kind = "loading",
  title,
  detail,
}: StudioLoadingPanelProps) {
  const isLoading = kind === "loading";
  const copy = panelCopy[kind];

  return (
    <section
      className="rounded-xl border border-orange-300/30 bg-orange-950/25 px-4 py-5 text-white sm:px-5"
      role={isLoading ? "status" : "alert"}
      aria-live={isLoading ? "polite" : undefined}
    >
      <div className="flex items-start gap-3">
        {isLoading && (
          <span
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 animate-spin rounded-full border-2 border-orange-200/25 border-t-orange-300 motion-reduce:animate-none"
          />
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-orange-100">{title ?? copy.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-orange-50/75">
            {detail ?? copy.detail}
          </p>
        </div>
      </div>
    </section>
  );
}
