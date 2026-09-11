import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function RewardfulConnectionConfirm() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("Confirming the organization’s Rewardful connection…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setState("error");
      setMessage("This confirmation link is invalid.");
      return;
    }
    fetch("/api/affiliate/organization/attach-existing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include",
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The connection could not be confirmed.");
      setState("success");
      setMessage(data.message || "The existing Rewardful account is now connected.");
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The connection could not be confirmed.");
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#100f18] px-5 py-16 text-white">
      <section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-xl font-bold">
          {state === "working" ? "Confirming Rewardful" : state === "success" ? "Rewardful Connected" : "Confirmation Unavailable"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">{message}</p>
        {state !== "working" && (
          <button
            type="button"
            onClick={() => setLocation(state === "success" ? "/business-center/affiliate/dashboard" : "/")}
            className="mt-6 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white"
          >
            {state === "success" ? "Return to Partner & Revenue" : "Return to My Perfect Meals"}
          </button>
        )}
        <p className="mt-5 text-[11px] leading-relaxed text-white/40">
          My Perfect Meals does not collect or store banking or payout credentials.
        </p>
      </section>
    </main>
  );
}