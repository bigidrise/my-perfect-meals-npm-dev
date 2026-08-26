import { Loader2, RotateCcw } from "lucide-react";

interface StudioVideoDeletionFailureNoticeProps {
  error?: string;
  isRetrying: boolean;
  onRetry: () => void;
}

/**
 * A failed private-media deletion is retryable. Keep the message history visible
 * and provide an explicit retry control rather than replacing the conversation
 * with a page-level error.
 */
export default function StudioVideoDeletionFailureNotice({
  error,
  isRetrying,
  onRetry,
}: StudioVideoDeletionFailureNoticeProps) {
  return (
    <div
      role="alert"
      data-testid="studio-video-delete-retry"
      className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-[10px] text-amber-100"
    >
      <p>{error || "The private video could not be deleted yet."}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        data-testid="retry-studio-video-delete"
        className="mt-1 flex items-center gap-1 font-medium text-amber-200 hover:text-white disabled:opacity-50"
      >
        {isRetrying
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <RotateCcw className="h-3 w-3" />}
        {isRetrying ? "Retrying deletion…" : "Try deletion again"}
      </button>
    </div>
  );
}