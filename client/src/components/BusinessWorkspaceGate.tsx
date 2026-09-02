import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";

export function BusinessWorkspaceGate({
  children,
  mode = "entry",
}: {
  children: React.ReactNode;
  mode?: "entry" | "setup";
}) {
  const [, setLocation] = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const businessId = params.get("businessId");
    if (businessId) sessionStorage.setItem("mpm_active_business_id", businessId);
    fetch(mode === "setup" ? "/api/business/setup-eligibility" : "/api/business/eligibility", {
      headers: getAuthHeaders(),
      credentials: "include",
    }).then(async (response) => {
      if (!response.ok) return false;
      const result = await response.json();
      return mode === "setup" ? result.canSetup === true : result.canEnter === true;
    }).then(setAllowed).catch(() => setAllowed(false));
  }, [mode]);

  if (allowed === null) return null;
  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold">Business workspace unavailable</h1>
        <p className="mt-3 text-muted-foreground">
          You do not have access to an active Business organization.
        </p>
        <button className="mt-6 rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={() => setLocation("/more")}>
          Return to Personal
        </button>
      </main>
    );
  }
  return <>{children}</>;
}