import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/queryClient";

type OfferInfo = {
  name: string;
  organizationName: string;
  trialDays: number;
  expiresAt: string | null;
  available: boolean;
  referralToken: string | null;
};

export default function BusinessOfferJoinPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [token] = useState(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (fragmentToken) {
      sessionStorage.setItem("mpm.businessOfferToken", fragmentToken);
      window.history.replaceState(null, "", "/join/business-offer");
      return fragmentToken;
    }
    return sessionStorage.getItem("mpm.businessOfferToken") ?? "";
  });
  const [info, setInfo] = useState<OfferInfo | null>(null);
  const [message, setMessage] = useState(token ? "Checking this Business Offer…" : "This Business Offer is unavailable.");

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl("/api/business-offers/inspect"), {
      headers: { "x-business-offer-token": token },
    }).then(async (response) => {
      if (!response.ok) throw new Error("This Business Offer is unavailable.");
      return response.json();
    }).then((offer: OfferInfo) => {
      setInfo(offer);
      if (offer.referralToken) {
        const url = new URL(window.location.href);
        url.searchParams.set("via", offer.referralToken);
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }
    }).catch((error) => setMessage(error.message));
  }, [token]);

  useEffect(() => {
    if (!user || !info?.available || !token) return;
    setMessage("Activating your complimentary access…");
    apiRequest("/api/business-offers/redeem", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((result: any) => {
      sessionStorage.removeItem("mpm.businessOfferToken");
      setMessage(`Your ${result.trialDays}-day access is ready.`);
      setTimeout(() => setLocation(user.onboardingCompletedAt ? "/dashboard" : "/onboarding"), 500);
    }).catch((error) => setMessage(error?.message ?? "This Business Offer could not be redeemed."));
  }, [user, info, token, setLocation]);

  if (!info) return <main className="min-h-screen bg-background p-8 text-center"><p>{message}</p></main>;
  if (!user) return (
    <main className="min-h-screen bg-background p-8 text-center space-y-5">
      <h1 className="text-2xl font-semibold">{info.name}</h1>
      <p>{info.organizationName} is offering {info.trialDays} days of complimentary My Perfect Meals access.</p>
      {!info.available && <p className="text-muted-foreground">This offer is no longer available.</p>}
      {info.available && <button className="rounded bg-primary px-5 py-3 text-primary-foreground" onClick={() => {
        sessionStorage.setItem("mpm.businessOfferToken", token);
        setLocation("/auth?businessOffer=1");
      }}>Sign in or create your account</button>}
    </main>
  );
  return <main className="min-h-screen bg-background p-8 text-center"><h1 className="text-2xl font-semibold">{info.name}</h1><p>{message}</p></main>;
}