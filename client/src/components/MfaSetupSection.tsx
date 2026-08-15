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

export function MfaSetupSection() {
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
      setStatus(data as MfaStatus);
      setPhase("idle");
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

  function copyToClipboard(text: string, type: "secret" | "backup") {
    navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
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

        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="w-full bg-orange-600 text-white font-semibold rounded-xl py-3"
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
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <p className="font-semibold text-white">{t("mfa.scanTitle")}</p>
            <p className="text-xs text-white/50">{t("mfa.scanApps")}</p>
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

        {secret && (
          <div className="space-y-1">
            <p className="text-xs text-white/40">{t("mfa.manualKeyPrompt")}</p>
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <span className="flex-1 font-mono text-xs text-white/70 break-all">{secret}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(secret, "secret")}
                className="shrink-0 text-white/40"
              >
                {copiedSecret ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setPhase("setup-confirm"); setErr(null); }}
          className="w-full bg-orange-600 text-white font-semibold rounded-xl py-3"
        >
          {t("mfa.addedAccountNext")}
        </button>

        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="w-full text-white/40 text-sm py-1"
        >
          {t("mfa.cancel")}
        </button>
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
