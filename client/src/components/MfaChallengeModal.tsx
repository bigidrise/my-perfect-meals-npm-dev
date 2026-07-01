/**
 * MfaChallengeModal
 *
 * Shown after a successful password login when the server returns
 * `{ mfaRequired: true }`. Prompts for the 6-digit TOTP code (or a
 * backup code) and calls the challenge endpoint to complete login.
 */

import { useState } from "react";
import { Shield, KeyRound, AlertCircle } from "lucide-react";
import { completeMfaChallenge } from "@/lib/auth";
import type { User } from "@/lib/auth";

interface Props {
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

export function MfaChallengeModal({ onSuccess, onCancel }: Props) {
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const user = await completeMfaChallenge(code.trim(), useBackup);
      onSuccess(user);
    } catch (err: any) {
      setError(err?.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-black/80 via-orange-950/20 to-black/80 shadow-2xl p-6">

        <div className="flex flex-col items-center mb-5">
          <div className="w-12 h-12 rounded-full bg-orange-600/20 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Two-Factor Verification</h2>
          <p className="text-sm text-white/60 text-center mt-1">
            {useBackup
              ? "Enter one of your saved backup codes."
              : "Open your authenticator app and enter the 6-digit code."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type={useBackup ? "text" : "text"}
            inputMode={useBackup ? "text" : "numeric"}
            pattern={useBackup ? undefined : "[0-9 ]*"}
            maxLength={useBackup ? 10 : 7}
            autoComplete="one-time-code"
            placeholder={useBackup ? "XXXXXXXXXX" : "000 000"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder:text-white/30 focus:outline-none focus:border-orange-500/60"
            autoFocus
          />

          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setUseBackup(!useBackup); setCode(""); setError(null); }}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/70 text-sm rounded-xl py-2.5 transition-colors hover:bg-white/10"
          >
            <KeyRound className="w-4 h-4" />
            {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-white/40 text-sm py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
