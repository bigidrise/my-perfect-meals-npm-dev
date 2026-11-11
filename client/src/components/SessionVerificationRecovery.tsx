/** Shared by both startup gates; neither mounts account widgets while unverified. */
export function SessionVerificationRecovery({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-black">
      <img src="/icons/chef.png?v=2026b" alt="" className="mb-4 h-20 w-20" />
      <div role="alert" className="max-w-xs space-y-4 px-4 text-center">
        <p className="text-sm text-white/80">
          We couldn’t verify your session. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-orange-400/50 px-4 py-2 text-sm font-semibold text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          Retry session check
        </button>
      </div>
    </div>
  );
}
