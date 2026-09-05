/**
 * MfaSetupSection
 *
 * Account settings panel for managing TOTP-based two-factor authentication.
 * Placed in the More / Account Settings page.
 *
 * States:
 *  - MFA disabled: "Enable 2FA" button → setup flow
 *  - Setup flow: QR code + secret + confirm code → backup codes shown once
 *  - MFA enabled: enrolled date + "Disable 2FA" button → confirm with code
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Shield, ShieldCheck, ShieldOff, Copy, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { setAuthToken } from "@/lib/auth";

interface MfaStatus {
  mfaEnabled: boolean;
  enrolledAt: string | null;
}

type Phase =
  | "idle"
  | "loading"
  | "setup-qr"
  | "setup-confirm"
  | "setup-backup"
  | "disable-confirm";

interface MfaSetupSectionProps {
  enrollmentRequired?: boolean;
  onEnrollmentComplete?: () => Promise<void> | void;
}

export function MfaSetupSection({
  enrollmentRequired = false,
  onEnrollmentComplete,
}: MfaSetupSectionProps = {}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setPhase("loading");
    try {
      const data = await apiRequest("/api/auth/mfa/status");
      const nextStatus = data as MfaStatus;
      setStatus(nextStatus);
      if (enrollmentRequired && !nextStatus.mfaEnabled) {
        await beginSetup();
      } else {
        setPhase("idle");
      }
    } catch (e: any) {
      console.error("[MFA] fetchStatus failed:", e?.message, e);
      setPhase("idle");
    }
  }

  async function beginSetup() {
    setBusy(true);
    setErr(null);
    try {
      const data = await apiRequest("/api/auth/mfa/setup/begin", { method: "POST" });
      setQrDataUri((data as any).qrDataUri);
      setSecret((data as any).secret);
      setPhase("setup-qr");
    } catch (e: any) {
      console.error("[MFA] beginSetup failed:", e?.message, e);
      setErr(e?.message || t("mfa.errorStartSetup"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    if (!confirmCode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await apiRequest("/api/auth/mfa/setup/confirm", { method: "POST", body: JSON.stringify({ code: confirmCode.trim() }) });
      const authToken = (data as any).authToken;
      if (authToken) {
        setAuthToken(authToken);
      }
      setBackupCodes((data as any).backupCodes || []);
      setPhase("setup-backup");
      setStatus({ mfaEnabled: true, enrolledAt: new Date().toISOString() });
    } catch (e: any) {
      setErr(e?.message || t("mfa.errorInvalidCode"));
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    if (!disableCode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await apiRequest("/api/auth/mfa", { method: "DELETE", body: JSON.stringify({ code: disableCode.trim() }) });
      setStatus({ mfaEnabled: false, enrolledAt: null });
      setPhase("idle");
      setDisableCode("");
    } catch (e: any) {
      setErr(e?.message || t("mfa.errorDisableInvalid"));
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string, type: "secret" | "backup") {
    setErr(null);
    try {
      await navigator.clipboard.writeText(text);
      if (type === "secret") {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackup(true);
        setTimeout(() => setCopiedBackup(false), 2000);
      }
    } catch {
      setErr(
        type === "secret"
          ? "We couldn't copy the setup key automatically. Press and hold the selectable key below to copy it manually."
          : "We couldn't copy the backup codes automatically. Select and copy them manually.",
      );
    }
  }

  async function finishEnrollment() {
    setBusy(true);
    setErr(null);
    try {
      if (onEnrollmentComplete) {
        await onEnrollmentComplete();
      } else {
        setPhase("idle");
      }
    } catch (e: any) {
      setErr(e?.message || "Two-factor authentication was enabled, but the session could not be refreshed. Please sign in again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 py-4 text-white/40 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        {t("mfa.loading")}
      </div>
    );
  }

  // ── Backup codes display (one-time) ─────────────────────────────────────────
  if (phase === "setup-backup") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <p className="font-semibold text-white">{t("mfa.enabledTitle")}</p>
            <p className="text-xs text-white/50">{t("mfa.saveBackupPrompt")}</p>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">
            {t("mfa.backupCodesHeading")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <span key={c} className="font-mono text-sm text-white/80 bg-white/5 px-2 py-1 rounded-lg text-center">
                {c}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(backupCodes.join("\n"), "backup")}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/70 text-sm rounded-xl py-2"
          >
            {copiedBackup ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copiedBackup ? t("mfa.copied") : t("mfa.copyAllCodes")}
          </button>
        </div>

        <p className="text-xs text-white/40">
          {t("mfa.backupCodesNote")}
        </p>

        {err && (
          <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-sm text-red-300">{err}</span>
          </div>
        )}

        <button
          type="button"
          onClick={finishEnrollment}
          disabled={busy}
          className="w-full bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3"
        >
          {t("mfa.savedBackupBtn")}
        </button>
      </div>
    );
  }

  // ── MFA enabled — idle view ──────────────────────────────────────────────────
  if (status?.mfaEnabled && phase === "idle") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="font-semibold text-white">{t("mfa.onTitle")}</p>
            {status.enrolledAt && (
              <p className="text-xs text-white/40">
                {t("mfa.enabledOn", { date: new Date(status.enrolledAt).toLocaleDateString() })}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setPhase("disable-confirm"); setErr(null); }}
          className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/70 text-sm rounded-xl px-4 py-2.5"
        >
          <ShieldOff className="w-4 h-4" />
          {t("mfa.disable2fa")}
        </button>
      </div>
    );
  }

  // ── Disable confirm ──────────────────────────────────────────────────────────
  if (phase === "disable-confirm") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldOff className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <p className="font-semibold text-white">{t("mfa.disableTitle")}</p>
            <p className="text-xs text-white/50">{t("mfa.disablePrompt")}</p>
          </div>
        </div>

        {err && (
          <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-sm text-red-300">{err}</span>
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          placeholder="000 000"
          value={disableCode}
          onChange={(e) => setDisableCode(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder:text-white/30 focus:outline-none focus:border-orange-500/60"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setPhase("idle"); setErr(null); setDisableCode(""); }}
            className="flex-1 bg-white/5 border border-white/10 text-white/70 text-sm rounded-xl py-3"
          >
            {t("mfa.cancel")}
          </button>
          <button
            type="button"
            onClick={disableMfa}
            disabled={busy || !disableCode.trim()}
            className="flex-1 bg-red-700/80 disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-3"
          >
            {busy ? t("mfa.disabling") : t("mfa.disable2fa")}
          </button>
        </div>
      </div>
    );
  }

  // ── Setup QR ─────────────────────────────────────────────────────────────────
  if (phase === "setup-qr") {
    return (
      <div className="space-y-5">
        <section className="space-y-3" aria-labelledby="mfa-qr-heading">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
              <h2 id="mfa-qr-heading" className="font-semibold text-white">Scan QR code</h2>
              <p className="text-xs text-white/50">
                If My Perfect Meals is open on a computer or another device, scan this QR code with your authenticator app.
              </p>
            </div>
          </div>

          {qrDataUri && (
            <div className="flex justify-center">
              <img
                src={qrDataUri}
                alt={t("mfa.qrAlt")}
                className="w-44 h-44 rounded-xl bg-white p-2"
              />
            </div>
          )}
        </section>

        {secret && (
          <section
            className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4"
            aria-labelledby="mfa-manual-heading"
          >
            <div>
              <h2 id="mfa-manual-heading" className="font-semibold text-white">Using this phone?</h2>
              <p className="mt-1 text-sm text-white/70">
                You do not need to create another My Perfect Meals account. Add My Perfect Meals to your authenticator app using the setup key below.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <span className="flex-1 select-all font-mono text-sm text-white/80 break-all" aria-label="Authenticator setup key">
                {secret}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(secret, "secret")}
                className="shrink-0 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white"
              >
                {copiedSecret ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copiedSecret ? "Setup key copied" : "Copy setup key"}
              </button>
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-900/30 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span className="text-sm text-red-300">{err}</span>
              </div>
            )}

            <ol className="list-decimal space-y-1 pl-5 text-sm text-white/70">
              <li>Tap <strong className="text-white">Copy setup key</strong>.</li>
              <li>Open your authenticator app.</li>
              <li>Choose <strong className="text-white">Add account</strong> or <strong className="text-white">Enter a setup key</strong>.</li>
              <li>Use <strong className="text-white">My Perfect Meals</strong> as the account or service name if asked.</li>
              <li>Paste the setup key and choose <strong className="text-white">Time based</strong> if asked.</li>
              <li>Return here and enter the 6-digit authentication code.</li>
            </ol>

            <p className="text-sm text-white/70">
              “Add account” in your authenticator app does not create a new My Perfect Meals account. It only adds two-factor authentication to your existing My Perfect Meals login.
            </p>
            <p className="text-xs text-white/50">
              If your authenticator already has an entry with this name, do not delete it automatically. Give this authenticator entry a descriptive label, such as “My Perfect Meals” or “My Perfect Meals – personal.” This changes only the label inside your authenticator app, not your My Perfect Meals account.
            </p>
          </section>
        )}

        <button
          type="button"
          onClick={() => { setPhase("setup-confirm"); setErr(null); }}
          className="w-full bg-orange-600 text-white font-semibold rounded-xl py-3"
        >
          {t("mfa.addedAccountNext")}
        </button>

        {!enrollmentRequired && (
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="w-full text-white/40 text-sm py-1"
          >
            {t("mfa.cancel")}
          </button>
        )}
      </div>
    );
  }

  // ── Setup confirm code ───────────────────────────────────────────────────────
  if (phase === "setup-confirm") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <p className="font-semibold text-white">{t("mfa.confirmTitle")}</p>
            <p className="text-xs text-white/50">{t("mfa.confirmPrompt")}</p>
          </div>
        </div>

        {err && (
          <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-sm text-red-300">{err}</span>
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          autoComplete="one-time-code"
          placeholder="000 000"
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder:text-white/30 focus:outline-none focus:border-orange-500/60"
          autoFocus
        />

        <button
          type="button"
          onClick={confirmSetup}
          disabled={busy || !confirmCode.trim()}
          className="w-full bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3"
        >
          {busy ? t("mfa.activating") : t("mfa.activate2fa")}
        </button>

        <button
          type="button"
          onClick={() => { setPhase("setup-qr"); setErr(null); }}
          className="w-full text-white/40 text-sm py-1"
        >
          {t("mfa.back")}
        </button>
      </div>
    );
  }

  // ── MFA disabled — idle view (default) ──────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-white/40 shrink-0" />
        <div>
          <p className="font-semibold text-white">{t("mfa.defaultTitle")}</p>
          <p className="text-xs text-white/40">{t("mfa.defaultSubtitle")}</p>
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <span className="text-sm text-red-300">{err}</span>
        </div>
      )}

      <button
        type="button"
        onClick={beginSetup}
        disabled={busy}
        className="flex items-center gap-2 bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2.5"
      >
        <Shield className="w-4 h-4" />
        {busy ? t("mfa.settingUp") : t("mfa.enable2fa")}
      </button>
    </div>
  );
}
