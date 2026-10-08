import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import DemoCareInvitation from "@/components/pro/DemoCareInvitation";
import ProClients from "@/pages/pro/ProClients";
import { apiRequest } from "@/lib/queryClient";
import { logout } from "@/lib/auth";
import {
  acknowledgeDemoOnly,
  exportDemoPatient,
  getDemoContext,
  getDemoMedia,
  getDemoMessages,
  getDemoPatient,
  getDemoPatients,
  readDemoMedia,
  saveDemoPlan,
} from "@/lib/demoProfessional";
import { DEMO_ACKNOWLEDGMENT_VERSION, isDemoGrantCurrent, isPermanentFounderDemoGrant, type DemoCapability, type DemoContext, type DemoPlan } from "@shared/demoProfessional";
import DemoSyntheticPatientView, {
  DemoBlockedScreen,
} from "@/components/pro/DemoSyntheticPatientView";

type PatientSummary = { id: string; label: string; scenario: string };
type PatientDetail = Awaited<ReturnType<typeof getDemoPatient>>;
type DemoMessage = Awaited<ReturnType<typeof getDemoMessages>>["messages"][number];
type MediaItem = Awaited<ReturnType<typeof getDemoMedia>>["media"][number];
type MediaContent = Awaited<ReturnType<typeof readDemoMedia>>;
type DemoProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  professionalRole: string | null;
  preferredLanguage: string;
};
function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The request could not be completed. Please try again.";
}

function isUsableContext(context: DemoContext | null, accountId: string): context is DemoContext {
  if (!context) return false;
  const grant = context.grant;
  return context.operatingStatus === "demo_only" &&
    context.persona === "physician" &&
    grant.persona === "physician" &&
    grant.operatingStatus === "demo_only" &&
    grant.state === "active" &&
    grant.userId === accountId &&
    isDemoGrantCurrent(grant) &&
    context.workspace.classification === "synthetic" &&
    (!context.clinic || (context.clinic.type === "clinic" && context.clinic.syntheticOnly === true)) &&
    context.realClinicalReadiness === false &&
    context.credentialVerificationGranted === false &&
    context.academyCompletionGranted === false &&
    context.realAgreementsGranted === false &&
    context.paidSubscriptionGranted === false;
}

export default function DemoPhysicianWorkspace({ fallback }: { fallback?: ReactNode }) {
  const { user, loading: authLoading, refreshUser, setUser } = useAuth();
  const [, setLocation] = useLocation();
  const accountId = user?.id ?? "";
  const [context, setContext] = useState<DemoContext | null>(null);
  const [loadedAccountId, setLoadedAccountId] = useState("");
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");
  const [expiryPulse, setExpiryPulse] = useState(0);
  const [ackBusy, setAckBusy] = useState(false);
  const [ackError, setAckError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const [planFocus, setPlanFocus] = useState<DemoPlan["nutritionFocus"]>("balanced_meals");
  const [followupDays, setFollowupDays] = useState("7");
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planSaved, setPlanSaved] = useState(false);
  const [readingMedia, setReadingMedia] = useState<MediaContent | null>(null);
  const [mediaBusyId, setMediaBusyId] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportDone, setExportDone] = useState(false);
  const [storedProfile, setStoredProfile] = useState<DemoProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editLanguage, setEditLanguage] = useState("auto");

  const contextEpoch = useRef(0);
  const detailEpoch = useRef(0);
  const profileEpoch = useRef(0);
  const accountRef = useRef(accountId);
  const capabilitySet = useMemo(() => new Set<DemoCapability>(context?.grant.capabilities ?? []), [context]);
  const contextReady = isUsableContext(context, accountId);
  const founderAuthority = context?.grant.authority === "development_founder" &&
    context.grant.lifetime === "permanent_founder" &&
    context.grant.userId === accountId;
  const canUseDemo = Boolean(contextReady && acknowledged);
  const canReadPatients = canUseDemo && capabilitySet.has("patient.read");
  const canReadClinical = canUseDemo && capabilitySet.has("clinical.read");
  const canWriteClinical = canUseDemo && capabilitySet.has("clinical.write");
  const canReadMessages = canUseDemo && capabilitySet.has("messages.read");
  const canReadMedia = canUseDemo && capabilitySet.has("media.read");
  const canExport = canUseDemo && capabilitySet.has("export");
  const selectedSummary = patients.find(item => item.id === selectedId);
  const planDirty = Boolean(patient && (
    patient.plan?.nutritionFocus !== planFocus ||
    String(patient.plan?.followupDays ?? 7) !== followupDays
  ));

  const clearWorkspace = useCallback(() => {
    detailEpoch.current += 1;
    profileEpoch.current += 1;
    setContext(null);
    setLoadedAccountId("");
    setContextError("");
    setContextLoading(true);
    setAcknowledged(false);
    setAckError("");
    setAckBusy(false);
    setPatients([]);
    setPatientsError("");
    setPatientsLoading(false);
    setSelectedId("");
    setPatient(null);
    setMessages([]);
    setMedia([]);
    setDetailLoading(false);
    setDetailError("");
    setDetailRetry(0);
    setPlanFocus("balanced_meals");
    setFollowupDays("7");
    setPlanBusy(false);
    setPlanError("");
    setPlanSaved(false);
    setReadingMedia(null);
    setMediaBusyId("");
    setMediaError("");
    setExportBusy(false);
    setExportError("");
    setExportDone(false);
    setStoredProfile(null);
    setProfileLoading(false);
    setProfileError("");
    setProfileEditing(false);
    setProfileSaving(false);
    setProfileSaveError("");
    setProfileSaved(false);
    setEditFirstName("");
    setEditLastName("");
    setEditLanguage("auto");
  }, []);

  const loadContext = useCallback(async (epoch: number) => {
    setContextLoading(true);
    setContextError("");
    try {
      const result = await getDemoContext();
      if (contextEpoch.current !== epoch) return;
      const founderContext = result;
      setContext(founderContext);
      setLoadedAccountId(accountId);
      setAcknowledged(Boolean(
        !founderContext.acknowledgmentRequired &&
        founderContext.grant.acknowledgedAt &&
        founderContext.grant.acknowledgmentVersion === DEMO_ACKNOWLEDGMENT_VERSION
      ));
    } catch (error) {
      if (contextEpoch.current === epoch) {
        setContext(null);
        setLoadedAccountId(accountId);
        setContextError(messageOf(error));
      }
    } finally {
      if (contextEpoch.current === epoch) setContextLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    accountRef.current = accountId;
    const epoch = ++contextEpoch.current;
    clearWorkspace();
    if (authLoading) return;
    if (!accountId) {
      setContextLoading(false);
      setContextError("Sign in to request a server-authorized demonstration context.");
      return;
    }
    void loadContext(epoch);
    return () => { contextEpoch.current += 1; detailEpoch.current += 1; };
  }, [accountId, authLoading, clearWorkspace, loadContext]);

  useEffect(() => {
    if (!context) return;
    if (context.grant.expiresAt === null) return;
    const delay = new Date(context.grant.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      setExpiryPulse(value => value + 1);
      return;
    }
    const timer = window.setTimeout(() => setExpiryPulse(value => value + 1), Math.min(delay + 20, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [context]);

  useEffect(() => {
    if (!contextReady || !accountId) return;
    const epoch = ++profileEpoch.current;
    let active = true;
    setProfileLoading(true);
    setProfileError("");
    apiRequest<DemoProfile>("/api/user/profile")
      .then(profile => {
        if (!active || profileEpoch.current !== epoch || accountRef.current !== accountId || profile.id !== accountId) return;
        setStoredProfile(profile);
        setEditFirstName(profile.firstName || "");
        setEditLastName(profile.lastName || "");
        setEditLanguage(profile.preferredLanguage || "auto");
      })
      .catch(error => {
        if (active && profileEpoch.current === epoch && accountRef.current === accountId) setProfileError(messageOf(error));
      })
      .finally(() => {
        if (active && profileEpoch.current === epoch && accountRef.current === accountId) setProfileLoading(false);
      });
    return () => { active = false; profileEpoch.current += 1; };
  }, [accountId, contextReady]);

  const refreshPatients = useCallback(async () => {
    if (!canReadPatients || !context || accountRef.current !== accountId) return;
    const epoch = contextEpoch.current;
    setPatientsLoading(true);
    setPatientsError("");
    try {
      const result = await getDemoPatients(context.workspace.id);
      if (contextEpoch.current === epoch && accountRef.current === accountId) setPatients(result.patients);
    } catch (error) {
      if (contextEpoch.current === epoch && accountRef.current === accountId) setPatientsError(messageOf(error));
    } finally {
      if (contextEpoch.current === epoch && accountRef.current === accountId) setPatientsLoading(false);
    }
  }, [accountId, canReadPatients, context]);

  useEffect(() => {
    if (!canReadPatients || !context) return;
    void refreshPatients();
  }, [canReadPatients, context?.workspace.id, refreshPatients]);

  const selectPatient = useCallback((id: string) => {
    detailEpoch.current += 1;
    setSelectedId(id);
    setPatient(null);
    setMessages([]);
    setMedia([]);
    setDetailError("");
    setDetailLoading(Boolean(id));
    setPlanFocus("balanced_meals");
    setFollowupDays("7");
    setPlanError("");
    setPlanSaved(false);
    setReadingMedia(null);
    setMediaError("");
    setExportError("");
    setExportDone(false);
  }, []);

  useEffect(() => {
    if (!selectedId || !context || !canReadPatients) return;
    const epoch = ++detailEpoch.current;
    const contextVersion = contextEpoch.current;
    const workspaceId = context.workspace.id;
    const permitted = {
      clinical: canReadClinical,
      messages: canReadMessages,
      media: canReadMedia,
    };
    setDetailLoading(true);
    setDetailError("");
    void Promise.all([
      permitted.clinical ? getDemoPatient(workspaceId, selectedId) : Promise.resolve(null),
      permitted.messages ? getDemoMessages(workspaceId, selectedId) : Promise.resolve({ messages: [] as DemoMessage[] }),
      permitted.media ? getDemoMedia(workspaceId, selectedId) : Promise.resolve({ media: [] as MediaItem[] }),
    ]).then(([detail, messageResult, mediaResult]) => {
      if (detailEpoch.current !== epoch || contextEpoch.current !== contextVersion || accountRef.current !== accountId) return;
      setPatient(detail);
      setMessages(messageResult.messages);
      setMedia(mediaResult.media);
      const nextPlan = detail?.plan ?? { nutritionFocus: "balanced_meals" as const, followupDays: 7 };
      setPlanFocus(nextPlan.nutritionFocus);
      setFollowupDays(String(nextPlan.followupDays));
    }).catch(error => {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) {
        setDetailError(messageOf(error));
      }
    }).finally(() => {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setDetailLoading(false);
    });
    return () => { detailEpoch.current += 1; };
  }, [accountId, canReadClinical, canReadMedia, canReadMessages, canReadPatients, context?.workspace.id, selectedId, detailRetry]);

  async function acknowledge() {
    if (!contextReady || ackBusy || acknowledged || accountRef.current !== accountId) return;
    const epoch = contextEpoch.current;
    setAckBusy(true);
    setAckError("");
    try {
      await acknowledgeDemoOnly();
      if (contextEpoch.current !== epoch || accountRef.current !== accountId) return;
      setAcknowledged(true);
      setContext(current => current ? {
        ...current,
        acknowledgmentRequired: false,
        grant: { ...current.grant, acknowledgedAt: new Date().toISOString(), acknowledgmentVersion: DEMO_ACKNOWLEDGMENT_VERSION },
      } : current);
    } catch (error) {
      if (contextEpoch.current === epoch && accountRef.current === accountId) setAckError(messageOf(error));
    } finally {
      if (contextEpoch.current === epoch && accountRef.current === accountId) setAckBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storedProfile || profileSaving || accountRef.current !== accountId) return;
    const firstName = editFirstName.trim();
    const lastName = editLastName.trim();
    if (firstName.length > 80 || lastName.length > 80) {
      setProfileSaveError("Names must be 80 characters or fewer.");
      return;
    }
    const epoch = profileEpoch.current;
    setProfileSaving(true);
    setProfileSaveError("");
    setProfileSaved(false);
    try {
      await apiRequest("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName,
          lastName,
          preferredLanguage: editLanguage,
        }),
      });
      const updated = await apiRequest<DemoProfile>("/api/user/profile");
      if (profileEpoch.current !== epoch || accountRef.current !== accountId || updated.id !== accountId) return;
      setStoredProfile(updated);
      setEditFirstName(updated.firstName || "");
      setEditLastName(updated.lastName || "");
      setEditLanguage(updated.preferredLanguage || "auto");
      setProfileEditing(false);
      setProfileSaved(true);
      try {
        await refreshUser();
      } catch {
        // The successful Development-local profile save remains authoritative for this screen.
      }
    } catch (error) {
      if (profileEpoch.current === epoch && accountRef.current === accountId) {
        setProfileSaveError(messageOf(error));
      }
    } finally {
      if (profileEpoch.current === epoch && accountRef.current === accountId) setProfileSaving(false);
    }
  }

  function signOut() {
    logout();
    setUser(null);
    setLocation("/welcome");
  }

  async function savePlan() {
    if (!canWriteClinical || !context || !patient || planBusy) return;
    const days = Number(followupDays);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      setPlanError("Choose a follow-up interval from 1 to 30 days.");
      return;
    }
    const epoch = detailEpoch.current;
    const contextVersion = contextEpoch.current;
    const patientId = patient.id;
    const plan: DemoPlan = { nutritionFocus: planFocus, followupDays: days };
    setPlanBusy(true);
    setPlanError("");
    setPlanSaved(false);
    try {
      const result = await saveDemoPlan(context.workspace.id, patientId, plan);
      if (detailEpoch.current !== epoch || contextEpoch.current !== contextVersion || accountRef.current !== accountId) return;
      setPatient(current => current?.id === patientId ? { ...current, plan: result.plan, revision: result.revision } : current);
      setPlanSaved(true);
    } catch (error) {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setPlanError(messageOf(error));
    } finally {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setPlanBusy(false);
    }
  }

  async function openMedia(item: MediaItem) {
    if (!canReadMedia || !context || !patient) return;
    const epoch = detailEpoch.current;
    const contextVersion = contextEpoch.current;
    setMediaBusyId(item.id);
    setMediaError("");
    setReadingMedia(null);
    try {
      const result = await readDemoMedia(context.workspace.id, patient.id, item.id);
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setReadingMedia(result);
    } catch (error) {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setMediaError(messageOf(error));
    } finally {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setMediaBusyId("");
    }
  }

  async function exportPatient() {
    if (!canExport || !context || !patient || exportBusy) return;
    const epoch = detailEpoch.current;
    const contextVersion = contextEpoch.current;
    const patientId = patient.id;
    setExportBusy(true);
    setExportError("");
    setExportDone(false);
    try {
      const result = await exportDemoPatient(context.workspace.id, patientId);
      if (detailEpoch.current !== epoch || contextEpoch.current !== contextVersion || accountRef.current !== accountId) return;
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mpm-synthetic-${patientId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportDone(true);
    } catch (error) {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setExportError(messageOf(error));
    } finally {
      if (detailEpoch.current === epoch && contextEpoch.current === contextVersion && accountRef.current === accountId) setExportBusy(false);
    }
  }

  const blockedReason = useMemo(() => {
    if (!context) return "";
    const grant = context.grant;
    if (grant.state !== "active") return grant.state === "revoked" ? "This demonstration grant has been revoked." : "This demonstration grant is prepared but not active.";
    if (!isDemoGrantCurrent(grant)) return "This demonstration grant has expired or is invalid.";
    if (context.workspace.classification !== "synthetic") return "The authorized workspace is not classified as synthetic. Access is blocked.";
    if (context.persona !== "physician" || grant.persona !== "physician") return "The server context is not authorized for the physician demonstration.";
    if (context.realClinicalReadiness !== false || context.credentialVerificationGranted !== false || context.academyCompletionGranted !== false || context.realAgreementsGranted !== false || context.paidSubscriptionGranted !== false) {
      return "The server context did not confirm the required isolated demonstration boundaries.";
    }
    return "";
  }, [context, expiryPulse]);

  if (authLoading || contextLoading || loadedAccountId !== accountId) {
    return (
      <main className="min-h-[100dvh] bg-[#f1f3eb] px-4 py-8 text-[#283c32] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-32 animate-pulse rounded-[1.75rem] bg-[#dce5d9]" />
          <div className="mt-6 grid gap-5 md:grid-cols-[320px_1fr]">
            <div className="h-[34rem] animate-pulse rounded-2xl bg-[#e1e9df]" />
            <div className="h-[34rem] animate-pulse rounded-2xl bg-[#e1e9df]" />
          </div>
        </div>
      </main>
    );
  }

  if ((contextError || !contextReady) && fallback && user?.operatingStatus !== "demo_only" && !founderAuthority) {
    return <>{fallback}</>;
  }

  if (contextError || !contextReady) {
    const blockedTitle = contextError ? "Demonstration context unavailable" : "Demonstration access is blocked";
    const blockedText = contextError || blockedReason || "The server has not authorized an active synthetic physician demonstration.";
    return (
          <DemoBlockedScreen
        title={blockedTitle}
        message={blockedText}
        onRetry={() => {
          const epoch = ++contextEpoch.current;
          setContext(null);
          setContextError("");
          setContextLoading(true);
          setPatients([]);
          setSelectedId("");
          setPatient(null);
          setAcknowledged(false);
          void loadContext(epoch);
        }}
      />
    );
  }

  const boundaryNotice = (
    <section className="rounded-xl border border-orange-300/40 bg-orange-950/30 px-4 py-4 text-white" aria-label="Synthetic-only acknowledgment">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200">Synthetic-only demonstration · physician persona</p>
          <p className="mt-1 text-sm leading-6 text-white/75">This is the Clinic workspace for a server-authorized, fictional patient environment. This acknowledgment is separate from normal professional agreements. Do not enter real patient information.</p>
          <p className="mt-1 text-xs leading-5 text-white/60">Live archive, unlink, and invitation actions are unavailable here. Care Team invitation creation and acceptance are simulated; messages are demo-provided and read-only.</p>
          <p className="mt-1 text-xs text-white/55">Account identity and physician demonstration persona are separate. No professional verification or clinical readiness is implied.</p>
          {ackError && <p className="mt-2 text-sm text-red-200" role="alert">{ackError}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-xs text-white/75">{context.clinic?.name || context.workspace.label} · synthetic workspace</span>
          {acknowledged ? (
            <span role="status" className="text-xs font-semibold text-emerald-200">Synthetic-only acknowledgment recorded</span>
          ) : (
            <button type="button" onClick={() => void acknowledge()} disabled={ackBusy} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60">
              {ackBusy ? "Recording…" : "Acknowledge synthetic-only use"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-[10px] text-white/65">
        {(["patient.read", "clinical.read", "clinical.write", "messages.read", "media.read", "export"] as DemoCapability[]).map(capability => (
          <span key={capability} className={`rounded-full border px-2 py-1 ${capabilitySet.has(capability) ? "border-emerald-200/30 bg-emerald-200/10 text-emerald-100" : "border-white/15 bg-black/10"}`}>{capability}</span>
        ))}
        <span className="ml-auto">{isPermanentFounderDemoGrant(context.grant) ? "Permanent founder demo · revocable · " : ""}Grant revision {context.grant.revision}</span>
      </div>
      <div className="mt-3 flex flex-col justify-between gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          {profileLoading ? (
            <div className="h-4 w-56 animate-pulse rounded bg-white/10" aria-label="Loading stored account profile" />
          ) : storedProfile ? (
            <>
              <p className="break-words text-xs font-semibold text-white/85">
                Account: {[storedProfile.firstName, storedProfile.lastName].filter(Boolean).join(" ") || storedProfile.email}
                {storedProfile.email && storedProfile.firstName && storedProfile.lastName ? ` · ${storedProfile.email}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                Stored role: {storedProfile.professionalRole || "not set"} · Demonstration persona: physician
              </p>
            </>
          ) : (
            <p className="text-xs text-orange-100" role={profileError ? "alert" : undefined}>
              {profileError ? `Stored account profile unavailable: ${profileError}` : "Stored account profile is not available."}
            </p>
          )}
          {profileSaved && <p className="mt-1 text-xs text-emerald-200" role="status">Development-local name and language preferences saved.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setProfileSaveError("");
              setProfileSaved(false);
              setProfileEditing(value => !value);
              if (!profileEditing && storedProfile) {
                setEditFirstName(storedProfile.firstName || "");
                setEditLastName(storedProfile.lastName || "");
                setEditLanguage(storedProfile.preferredLanguage || "auto");
              }
            }}
            disabled={!storedProfile || profileLoading || profileSaving}
            className="rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {profileEditing ? "Close profile editor" : "Edit name & language"}
          </button>
          <button type="button" onClick={signOut} className="rounded-lg border border-orange-200/35 bg-orange-200/10 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-200/20">
            Sign out
          </button>
        </div>
      </div>
      {profileEditing && (
        <form onSubmit={event => void saveProfile(event)} className="mt-3 grid gap-3 rounded-xl border border-white/15 bg-black/15 p-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-white/75">
            First name
            <input
              value={editFirstName}
              onChange={event => setEditFirstName(event.target.value)}
              maxLength={80}
              autoComplete="given-name"
              className="mt-1.5 min-h-10 w-full rounded-lg border border-white/20 bg-[#211b18] px-3 text-sm text-white outline-none focus:border-orange-200/70"
            />
          </label>
          <label className="text-xs font-semibold text-white/75">
            Last name
            <input
              value={editLastName}
              onChange={event => setEditLastName(event.target.value)}
              maxLength={80}
              autoComplete="family-name"
              className="mt-1.5 min-h-10 w-full rounded-lg border border-white/20 bg-[#211b18] px-3 text-sm text-white outline-none focus:border-orange-200/70"
            />
          </label>
          <label className="text-xs font-semibold text-white/75">
            Preferred language
            <select value={editLanguage} onChange={event => setEditLanguage(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/20 bg-[#211b18] px-3 text-sm text-white outline-none focus:border-orange-200/70">
              <option value="auto">Automatic</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="pt">Português</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
              <option value="hi">हिन्दी</option>
              <option value="ru">Русский</option>
              <option value="vi">Tiếng Việt</option>
              <option value="tl">Filipino</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <button type="submit" disabled={profileSaving || !storedProfile} className="rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-500 disabled:cursor-wait disabled:opacity-55">
              {profileSaving ? "Saving profile…" : "Save Development-local profile"}
            </button>
            <span className="text-[11px] text-white/50">Only first name, last name, and language are editable here. Clinical and professional fields remain unchanged.</span>
            {profileSaveError && <p className="w-full text-xs text-red-200" role="alert">{profileSaveError}</p>}
          </div>
        </form>
      )}
      {!acknowledged && <p className="mt-3 text-xs text-orange-100" role="status">Acknowledge this demonstration boundary before opening any synthetic patient folder.</p>}
    </section>
  );
  const patientDetail = (
    <div className="space-y-4">
      {context && patient && <DemoCareInvitation key={`${context.workspace.id}:${patient.id}`} workspaceId={context.workspace.id} patientId={patient.id} />}
      <DemoSyntheticPatientView
        selectedSummary={selectedSummary} patient={patient} detailLoading={detailLoading} detailError={detailError}
        onRetryDetail={() => setDetailRetry(value => value + 1)}
        canReadClinical={canReadClinical}
        canWriteClinical={canWriteClinical}
        canReadMessages={canReadMessages}
        canReadMedia={canReadMedia}
        canExport={canExport}
        planFocus={planFocus}
        onPlanFocusChange={value => { setPlanFocus(value); setPlanSaved(false); }}
        followupDays={followupDays}
        onFollowupDaysChange={value => { setFollowupDays(value); setPlanSaved(false); }}
        planDirty={planDirty}
        planBusy={planBusy}
        planError={planError}
        planSaved={planSaved}
        onSavePlan={() => void savePlan()}
        messages={messages}
        media={media}
        onOpenMedia={item => void openMedia(item)}
        mediaBusyId={mediaBusyId}
        mediaError={mediaError}
        readingMedia={readingMedia}
        onCloseMedia={() => setReadingMedia(null)}
        exportBusy={exportBusy}
        exportError={exportError}
        exportDone={exportDone}
        onExport={() => void exportPatient()}
      />
    </div>
  );
  return (
    <ProClients
      workspace="clinician"
      syntheticSource={{
        patients,
        selectedPatientId: selectedId,
        loading: patientsLoading,
        error: patientsError,
        onRefresh: () => void refreshPatients(),
        onSelect: id => {
          if (canUseDemo) selectPatient(id);
        },
        patientDetail,
        boundaryNotice,
      }}
    />
  );
}
