import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, UserX } from "lucide-react";

const PENDING_TOKEN_KEY = "mpm.pendingStudioInviteToken";

interface InviteMetadata {
  studioName: string;
  proName: string;
  // invitedEmail is intentionally omitted — the public endpoint only returns maskedEmail
  maskedEmail: string;
  studioType: "studio" | "clinic";
  expired: boolean;
  alreadyAccepted: boolean;
}

type PageState =
  | { kind: "loading" }
  | { kind: "preview"; metadata: InviteMetadata; token: string }
  | { kind: "joining" }
  | { kind: "success"; studioName: string }
  | { kind: "email_mismatch"; maskedEmail: string }
  | { kind: "expired" }
  | { kind: "already_accepted" }
  | { kind: "clinical_required" }
  | { kind: "coach_not_subscribed" }
  | { kind: "error"; message: string };

export default function JoinStudio() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  // Step 1 — resolve the token from URL or sessionStorage
  const urlToken = new URLSearchParams(search).get("token");
  const token = urlToken ?? sessionStorage.getItem(PENDING_TOKEN_KEY);

  useEffect(() => {
    // Persist token so it survives the auth redirect
    if (urlToken) {
      sessionStorage.setItem(PENDING_TOKEN_KEY, urlToken);
    }
  }, [urlToken]);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setState({ kind: "error", message: t("joinStudio.errorNoToken") });
      return;
    }

    // Step 2 — redirect to auth if not logged in, preserving returnTo
    if (!user) {
      setLocation("/auth?returnTo=/join/studio");
      return;
    }

    // Step 3 — fetch metadata
    (async () => {
      try {
        const res = await fetch(`/api/procare-invite/token/${encodeURIComponent(token)}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          setState({ kind: "error", message: t("joinStudio.errorNotFound") });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: t("joinStudio.errorLoadDetails") });
          return;
        }
        const metadata: InviteMetadata = await res.json();
        if (metadata.expired) {
          setState({ kind: "expired" });
          return;
        }
        if (metadata.alreadyAccepted) {
          setState({ kind: "already_accepted" });
          return;
        }
        setState({ kind: "preview", metadata, token });
      } catch {
        setState({ kind: "error", message: t("joinStudio.errorLoadDetailsNetwork") });
      }
    })();
  }, [authLoading, user, token, setLocation]);

  async function handleJoin() {
    if (state.kind !== "preview") return;
    setState({ kind: "joining" });
    try {
      const res = await fetch(`/api/procare-invite/token/${encodeURIComponent(state.token)}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (res.ok) {
        sessionStorage.removeItem(PENDING_TOKEN_KEY);
        setState({ kind: "success", studioName: data.membership?.studioName ?? state.metadata.studioName });
        return;
      }

      switch (data.error) {
        case "EMAIL_MISMATCH":
          setState({ kind: "email_mismatch", maskedEmail: data.maskedEmail ?? t("joinStudio.anotherAddress") });
          break;
        case "EXPIRED":
          setState({ kind: "expired" });
          break;
        case "ALREADY_ACCEPTED":
          setState({ kind: "already_accepted" });
          break;
        case "CLINICAL_REQUIRED":
          setState({ kind: "clinical_required" });
          break;
        case "COACH_NOT_SUBSCRIBED":
          setState({ kind: "coach_not_subscribed" });
          break;
        default:
          setState({ kind: "error", message: t("joinStudio.errorGenericFallback") });
      }
    } catch {
      setState({ kind: "error", message: t("joinStudio.errorConnectionIssue") });
    }
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / wordmark */}
        <div className="text-center mb-6">
          <img
            src="/icons/icon-192x192.png"
            alt={t("joinStudio.appName")}
            className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-lg"
          />
          <p className="text-white/60 text-sm tracking-wide uppercase">{t("joinStudio.appName")}</p>
        </div>

        <Card className="bg-gray-900 border-gray-800 shadow-2xl text-white">
          <CardHeader className="pb-2">
            {/* Header varies by state */}
          </CardHeader>
          <CardContent className="pt-0">
            <InviteBody state={state} onJoin={handleJoin} onGoHome={() => setLocation("/")} t={t} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InviteBody({
  state,
  onJoin,
  onGoHome,
  t,
}: {
  state: PageState;
  onJoin: () => void;
  onGoHome: () => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  if (state.kind === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-gray-400 text-sm">{t("joinStudio.loading")}</p>
      </div>
    );
  }

  if (state.kind === "joining") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-gray-400 text-sm">{t("joinStudio.joining")}</p>
      </div>
    );
  }

  if (state.kind === "preview") {
    const { metadata } = state;
    const spaceLabel = t(metadata.studioType === "clinic" ? "joinStudio.labelClinic" : "joinStudio.labelStudio");
    const roleLabel = t(metadata.studioType === "clinic" ? "joinStudio.roleDoctor" : "joinStudio.roleTrainer");
    return (
      <div className="flex flex-col gap-5 pt-2">
        {/* Invite card */}
        <div className="bg-gradient-to-br from-orange-600/20 to-orange-500/10 border border-orange-500/30 rounded-xl p-5 text-center">
          <ShieldCheck className="w-10 h-10 text-orange-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-1">{t("joinStudio.inviteTitle")}</h2>
          <p className="text-gray-300 text-sm mb-3">
            <span className="font-semibold text-white">{metadata.proName}</span>
            {t("joinStudio.invitedBySuffix", { spaceLabel })}
          </p>
          <div className="bg-black/30 rounded-lg px-4 py-2 inline-block">
            <p className="text-orange-300 text-xs uppercase tracking-wider mb-0.5">{spaceLabel}</p>
            <p className="text-white font-semibold">{metadata.studioName}</p>
          </div>
        </div>

        {/* Invited address notice */}
        <p className="text-center text-gray-400 text-xs">
          {t("joinStudio.inviteAddress")}{" "}
          <span className="text-white font-medium">{metadata.maskedEmail}</span>.{" "}
          {t("joinStudio.inviteAddressSuffix")}
        </p>

        <Button
          onClick={onJoin}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 rounded-full text-base"
        >
          {t("joinStudio.joinButton", { spaceLabel })}
        </Button>

        <p className="text-center text-gray-500 text-xs">
          {t("joinStudio.joinDisclaimer", { roleLabel })}
        </p>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-400" />
        <h2 className="text-xl font-bold text-white">{t("joinStudio.successTitle")}</h2>
        <p className="text-gray-300 text-sm">{t("joinStudio.successBody", { studioName: state.studioName })}</p>
        <Button
          onClick={onGoHome}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-full"
        >
          {t("joinStudio.goToApp")}
        </Button>
      </div>
    );
  }

  if (state.kind === "email_mismatch") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <UserX className="w-12 h-12 text-yellow-400" />
        <h2 className="text-lg font-bold text-white">{t("joinStudio.wrongAccountTitle")}</h2>
        <p className="text-gray-300 text-sm">
          {t("joinStudio.wrongAccountAddress")}{" "}
          <span className="text-white font-semibold">{state.maskedEmail}</span>.{" "}
          {t("joinStudio.wrongAccountDiffAccount")}
        </p>
        <p className="text-gray-400 text-xs">{t("joinStudio.wrongAccountHint")}</p>
        <Button
          onClick={onGoHome}
          variant="outline"
          className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full"
        >
          {t("joinStudio.backToApp")}
        </Button>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <h2 className="text-lg font-bold text-white">{t("joinStudio.expiredTitle")}</h2>
        <p className="text-gray-300 text-sm">{t("joinStudio.expiredBody")}</p>
        <p className="text-gray-400 text-xs">
          {t("joinStudio.backupCodeHint")} <strong>{t("joinStudio.backupCodePath")}</strong>
        </p>
        <Button onClick={onGoHome} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full w-full">
          {t("joinStudio.backToApp")}
        </Button>
      </div>
    );
  }

  if (state.kind === "already_accepted") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-400" />
        <h2 className="text-lg font-bold text-white">{t("joinStudio.alreadyConnectedTitle")}</h2>
        <p className="text-gray-300 text-sm">{t("joinStudio.alreadyConnectedBody")}</p>
        <Button onClick={onGoHome} className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-full">
          {t("joinStudio.goToApp")}
        </Button>
      </div>
    );
  }

  if (state.kind === "clinical_required") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <AlertTriangle className="w-12 h-12 text-orange-400" />
        <h2 className="text-lg font-bold text-white">{t("joinStudio.subscriptionRequiredTitle")}</h2>
        <p className="text-gray-300 text-sm">{t("joinStudio.subscriptionRequiredBody")}</p>
        <Button onClick={() => window.location.href = "/pricing"} className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-full">
          {t("joinStudio.viewPlans")}
        </Button>
        <Button onClick={onGoHome} variant="ghost" className="text-gray-400 hover:text-white text-sm">
          {t("joinStudio.backToApp")}
        </Button>
      </div>
    );
  }

  if (state.kind === "coach_not_subscribed") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <h2 className="text-lg font-bold text-white">{t("joinStudio.trainerNotSubscribedTitle")}</h2>
        <p className="text-gray-300 text-sm">{t("joinStudio.trainerNotSubscribedBody")}</p>
        <Button onClick={onGoHome} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full w-full">
          {t("joinStudio.backToApp")}
        </Button>
      </div>
    );
  }

  // Generic error — state is exhausted to { kind: "error"; message: string } here
  if (state.kind !== "error") return null;
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400" />
      <h2 className="text-lg font-bold text-white">{t("joinStudio.errorTitle")}</h2>
      <p className="text-gray-300 text-sm">{state.message}</p>
      <p className="text-gray-400 text-xs">
        {t("joinStudio.backupCodeHint")} <strong>{t("joinStudio.backupCodePath")}</strong>
      </p>
      <Button onClick={onGoHome} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 rounded-full w-full">
        {t("joinStudio.backToApp")}
      </Button>
    </div>
  );
}
