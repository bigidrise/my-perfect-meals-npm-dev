import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AntiInflammatorySupportControl } from "../../client/src/components/profile/AntiInflammatorySupportControl";
import { usePersonalAntiInflammatorySupport } from "../../client/src/hooks/usePersonalAntiInflammatorySupport";
import { MealImageSlot } from "../../client/src/components/ui/MealImageSlot";

const foreignImage = "/public-objects/replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491/meal-images/synthetic-review.jpg";
const localImage = "/public-objects/replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b/meal-images/synthetic-review.jpg";
const boardTarget = { weekStartISO: "2026-11-02", dateISO: "2026-11-06", slot: "breakfast", mealId: "synthetic-meal" };

const fixture = {
  account: "synthetic-a", failNextSave: false, delay: false,
  records: {
    "synthetic-a": { enabled: false, legacyPreferenceSaved: true },
    "synthetic-b": { enabled: false, legacyPreferenceSaved: false },
  } as Record<string, { enabled: boolean; legacyPreferenceSaved: boolean }>,
  writes: [] as unknown[],
  recoveries: [] as unknown[],
  async post(path: string, body: any) {
    if (path !== "/api/weekly-board/image-recovery" ||
      body.mealId !== boardTarget.mealId || body.weekStartISO !== boardTarget.weekStartISO ||
      body.dateISO !== boardTarget.dateISO || body.slot !== boardTarget.slot || body.imageUrl !== foreignImage) {
      throw new Error("Unauthorized synthetic recovery target");
    }
    this.recoveries.push({ account: this.account, body });
    // Existing local image delivery only: no model call and no canonical write.
    return { status: "recovered", imageUrl: localImage, mediaAssetId: "00000000-0000-4000-8000-000000000007" };
  },
  async request(path: string, options: RequestInit = {}) {
    if (path !== "/api/health-context/support/anti_inflammatory") throw new Error("Unexpected fixture request");
    const account = this.account;
    if (this.delay) await new Promise(resolve => setTimeout(resolve, 800));
    if (options.method === "PUT") {
      if (this.failNextSave) { this.failNextSave = false; throw new Error("Synthetic save failure"); }
      const body = JSON.parse(String(options.body));
      if (Object.keys(body).join() !== "enabled" || typeof body.enabled !== "boolean") throw new Error("Unexpected write");
      this.writes.push({ account, body });
      this.records[account] = { enabled: body.enabled, legacyPreferenceSaved: body.enabled };
      localStorage.setItem("anti-review-support", JSON.stringify(this.records));
    }
    return { ...this.records[account] };
  },
};
try { Object.assign(fixture.records, JSON.parse(localStorage.getItem("anti-review-support") || "{}")); } catch {}
(window as any).__antiReview = fixture;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Review() {
  const [account, setAccount] = useState(fixture.account);
  const [program, setProgram] = useState("General Nutrition");
  return <QueryClientProvider client={client}><main style={{ maxWidth: 640, margin: "auto", padding: 16 }}>
    <h1>Synthetic Anti-Inflammatory review</h1>
    <p>No real accounts, database, model calls, or outgoing API requests.</p>
    <label>Primary program <select aria-label="Primary program" value={program} onChange={event => setProgram(event.target.value)}>
      {["General Nutrition", "Diabetic", "GLP-1"].map(value => <option key={value}>{value}</option>)}
    </select></label>
    <p>Primary program remains: {program}</p>
    <label>Synthetic account <select aria-label="Synthetic account" value={account} onChange={event => {
      fixture.account = event.target.value; setAccount(event.target.value);
    }}><option value="synthetic-a">Account A</option><option value="synthetic-b">Account B</option></select></label>
    <label style={{ display: "block", margin: "16px 0" }}><input type="checkbox" onChange={e => { fixture.delay = e.target.checked; }} /> Delay responses</label>
    <label style={{ display: "block", margin: "16px 0" }}><input type="checkbox" onChange={e => { fixture.failNextSave = e.target.checked; }} /> Fail next save</label>
    <AntiInflammatorySupportControl userId={account} />
    <BuilderPreview account={account} program={program} />
  </main></QueryClientProvider>;
}
function BuilderPreview({ account, program }: { account: string; program: string }) {
  const support = usePersonalAntiInflammatorySupport({ actorUserId: account, subjectUserId: account });
  const [visible, setVisible] = useState(true);
  const [image, setImage] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem("anti-review-board") || "null")?.imageUrl ?? null; } catch { return null; }
  });
  return <section style={{ marginTop: 20 }}>
    <h2>{program} — real support hook and image component</h2>
    <p data-testid="support-indicator" style={{ color: support.enabled ? "#4ade80" : "#999" }}>
      ● Anti-Inflammatory: {support.enabled ? "On (optional; not a clinical diagnosis)" : support.available ? "Off" : "Checking"}
    </p>
    <p>Image API and Board persistence below are synthetic fixtures. No real account or meal is changed.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
      <button onClick={() => { setImage(localImage); setVisible(true); }}>Make synthetic preview</button>
      <button onClick={() => {
        localStorage.setItem("anti-review-board", JSON.stringify({ ...boardTarget, imageUrl: foreignImage }));
        setImage(foreignImage); setVisible(true);
      }}>Save fixture plan</button>
      <button onClick={() => setVisible(false)}>Navigate away</button>
      <button onClick={() => {
        setImage(JSON.parse(localStorage.getItem("anti-review-board") || "null")?.imageUrl ?? null); setVisible(true);
      }}>Return to builder</button>
    </div>
    {visible && image && <div data-testid="fixture-meal-image">
      <MealImageSlot imageUrl={image} mealName="Stored meal image fixture" boardTarget={boardTarget} height="h-48" />
    </div>}
  </section>;
}
createRoot(document.getElementById("root")!).render(<Review />);
