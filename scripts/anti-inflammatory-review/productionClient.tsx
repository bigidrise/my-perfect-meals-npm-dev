import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AntiInflammatorySupportControl } from "../../client/src/components/profile/AntiInflammatorySupportControl";
import { usePersonalAntiInflammatorySupport } from "../../client/src/hooks/usePersonalAntiInflammatorySupport";
import { ANTI_INFLAMMATORY_SUPPORT_ENABLED } from "../../shared/personalFoodSupportFreeze";

const storedAccount = /fixtureAccount=(synthetic-[ab])/.exec(document.cookie)?.[1] ?? "synthetic-a";
document.cookie = `fixtureAccount=${storedAccount};path=/;SameSite=Strict`;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Review() {
  const [account, setAccount] = useState(storedAccount);
  const program = new URLSearchParams(location.search).get("program") ?? "general_nutrition";
  const support = usePersonalAntiInflammatorySupport({ actorUserId: account, subjectUserId: account });
  const profile = location.pathname !== "/builder";
  return <main style={{ maxWidth: 620, padding: 20, margin: "auto" }}>
    <h1>Isolated production-mode support review</h1>
    <p>Compiled React production UI and real support API/persistence code. All records are synthetic and stored in memory. No application database or model calls.</p>
    <p data-testid="runtime">Frontend DEV: {String(import.meta.env.DEV)} · Backend: production / published fixture</p>
    <label>Synthetic account <select aria-label="Synthetic account" value={account} onChange={event => {
      document.cookie = `fixtureAccount=${event.target.value};path=/;SameSite=Strict`;
      setAccount(event.target.value);
    }}><option value="synthetic-a">Account A</option><option value="synthetic-b">Account B</option></select></label>
    <nav><a href="/profile">Profile</a>{" · "}
      {["general_nutrition", "diabetic", "glp1"].map(value =>
        <a key={value} style={{ marginRight: 12 }} href={`/builder?program=${value}`}>{value}</a>)}</nav>
    <h2>{profile ? "Profile control" : `${program} support indicator fixture`}</h2>
    <p>Primary program remains: {program}. Optional GLP-1 support remains paused.</p>
    {profile && ANTI_INFLAMMATORY_SUPPORT_ENABLED && <AntiInflammatorySupportControl key={account} userId={account} />}
    <p data-testid="support-indicator">Anti-Inflammatory: {support.enabled ? "On (optional; not a clinical diagnosis)" : support.available ? "Off" : "Checking"}</p>
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Review /></QueryClientProvider>);
