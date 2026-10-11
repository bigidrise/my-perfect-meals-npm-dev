import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

type MfaStatus = { mfaEnabled: boolean; sessionVerified: boolean };

/** Informational only: the server still authorizes every invitation request. */
export default function DevelopmentPilotMfaStatus() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    apiRequest<MfaStatus>("/api/auth/mfa/status").then((data) => {
      if (typeof data?.mfaEnabled !== "boolean" || typeof data?.sessionVerified !== "boolean") {
        throw new Error("Invalid MFA status");
      }
      if (current) setStatus(data);
    }).catch(() => {
      if (current) setFailed(true);
    });
    return () => { current = false; };
  }, []);

  return (
    <section className="mt-5 rounded-xl border border-white/15 p-4" aria-label="Development MFA status">
      <h2 className="font-semibold">Development MFA status</h2>
      {failed ? (
        <p role="alert" className="mt-2 text-red-300">Could not verify MFA status. No access has been granted.</p>
      ) : status ? (
        <dl className="mt-2 space-y-2">
          <div><dt className="inline">MFA enabled: </dt><dd className="inline">{status.mfaEnabled ? "Yes" : "No"}</dd></div>
          <div><dt className="inline">Current session verified: </dt><dd className="inline">{status.sessionVerified ? "Yes" : "No"}</dd></div>
        </dl>
      ) : <p role="status" className="mt-2">Checking MFA status…</p>}
      <p className="mt-2 text-sm text-white/65">Read-only status. MFA enrollment and session verification are separate. Server authorization still applies.</p>
    </section>
  );
}
