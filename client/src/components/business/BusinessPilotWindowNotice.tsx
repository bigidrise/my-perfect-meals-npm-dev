import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth";

export default function BusinessPilotWindowNotice() {
  const [pilot, setPilot] = useState<any>(null);
  useEffect(() => {
    let current = true;
    fetch("/api/business/pilot-activation/status", {
      credentials: "include", headers: getAuthHeaders(), cache: "no-store",
    }).then(async response => {
      if (response.ok && current) setPilot(await response.json());
    }).catch(() => {});
    return () => { current = false; };
  }, []);
  if (!pilot) return null;
  return <aside className="my-4 rounded-xl border border-orange-500/30 p-4 text-sm text-orange-100">
    Your personal Clinical pilot ends {new Date(pilot.endsAt).toLocaleString()}.
    {!pilot.businessId && !pilot.organizationConsumed && " The new Organization you create shares this original end date; setup does not restart the 30 days."}
    {!pilot.businessId && pilot.organizationConsumed && " Your former Organization used this invitation. Removing it does not restart either pilot or fund another Organization."}
    {pilot.businessId && " Your linked Organization uses the same initial pilot end date. Paid continuation and personal access remain separate."}
    {" Patients keep their own invitation trial dates. No automatic charge."}
  </aside>;
}
