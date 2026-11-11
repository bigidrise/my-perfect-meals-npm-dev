import { useTranslation } from "react-i18next";

interface Props {
  error: string | null;
  busy: boolean;
  onRetry: () => void;
}

export function CreatorMenuRecovery({ error, busy, onRetry }: Props) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <div role="alert" className="mt-8 rounded-xl border border-amber-400/40 bg-black/40 p-4 text-white">
      <p className="font-semibold">{t("creatorMenuRecovery.title")}</p>
      <p className="mt-2 text-sm text-white/80">{error}</p>
      <button type="button" onClick={onRetry} disabled={busy}
        className="mt-3 min-h-11 rounded-xl border border-white/30 px-4 font-semibold disabled:opacity-50">
        {busy ? t("creatorMenuRecovery.checking") : t("creatorMenuRecovery.retry")}
      </button>
    </div>
  );
}
