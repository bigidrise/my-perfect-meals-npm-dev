import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DemoCareInvitation from "@/components/pro/DemoCareInvitation";
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
import { DEMO_ACKNOWLEDGMENT_VERSION, type DemoCapability, type DemoContext, type DemoPlan } from "@shared/demoProfessional";
import DemoSyntheticPatientView, {
  DemoBlockedScreen,
  DemoPhysicianHeader,
  DemoSyntheticPatientList,
} from "@/components/pro/DemoSyntheticPatientView";

type PatientSummary = { id: string; label: string; scenario: string };
type PatientDetail = Awaited<ReturnType<typeof getDemoPatient>>;
type DemoMessage = Awaited<ReturnType<typeof getDemoMessages>>["messages"][number];
type MediaItem = Awaited<ReturnType<typeof getDemoMedia>>["media"][number];
type MediaContent = Awaited<ReturnType<typeof readDemoMedia>>;

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The request could not be completed. Please try again.";
}

function isUsableContext(context: DemoContext | null): context is DemoContext {
  if (!context) return false;
  const grant = context.grant;
  return context.operatingStatus === "demo_only" &&
    context.persona === "physician" &&
    grant.persona === "physician" &&
    grant.operatingStatus === "demo_only" &&
    grant.state === "active" &&
    new Date(grant.expiresAt).getTime() > Date.now() &&
    context.workspace.classification === "synthetic" &&
    context.realClinicalReadiness === false &&
    context.credentialVerificationGranted === false &&
    context.academyCompletionGranted === false &&
    context.realAgreementsGranted === false &&
    context.paidSubscriptionGranted === false;
}

export default function DemoPhysicianWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const accountId = user?.id ?? "";
  const [context, setContext] = useState<DemoContext | null>(null);
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

  const contextEpoch = useRef(0);
  const detailEpoch = useRef(0);
  const accountRef = useRef(accountId);
  const capabilitySet = useMemo(() => new Set<DemoCapability>(context?.grant.capabilities ?? []), [context]);
  const contextReady = isUsableContext(context);
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
    setContext(null);
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
  }, []);

  const loadContext = useCallback(async (epoch: number) => {
    setContextLoading(true);
    setContextError("");
    try {
      const result = await getDemoContext();
      if (contextEpoch.current !== epoch) return;
      setContext(result);
      setAcknowledged(Boolean(
        !result.acknowledgmentRequired &&
        result.grant.acknowledgedAt &&
        result.grant.acknowledgmentVersion === DEMO_ACKNOWLEDGMENT_VERSION
      ));
    } catch (error) {
      if (contextEpoch.current === epoch) {
        setContext(null);
        setContextError(messageOf(error));
      }
    } finally {
      if (contextEpoch.current === epoch) setContextLoading(false);
    }
  }, []);

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
    const delay = new Date(context.grant.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      setExpiryPulse(value => value + 1);
      return;
    }
    const timer = window.setTimeout(() => setExpiryPulse(value => value + 1), Math.min(delay + 20, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [context]);

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
    if (new Date(grant.expiresAt).getTime() <= Date.now()) return "This demonstration grant has expired.";
    if (context.workspace.classification !== "synthetic") return "The authorized workspace is not classified as synthetic. Access is blocked.";
    if (context.persona !== "physician" || grant.persona !== "physician") return "The server context is not authorized for the physician demonstration.";
    if (context.realClinicalReadiness !== false || context.credentialVerificationGranted !== false || context.academyCompletionGranted !== false || context.realAgreementsGranted !== false || context.paidSubscriptionGranted !== false) {
      return "The server context did not confirm the required isolated demonstration boundaries.";
    }
    return "";
  }, [context, expiryPulse]);

  if (authLoading || contextLoading) {
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

  return (
    <main className="min-h-[100dvh] bg-[#f1f3eb] text-[#283c32]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-8">
        <DemoPhysicianHeader
          context={context} acknowledged={acknowledged} ackBusy={ackBusy} ackError={ackError}
          capabilities={capabilitySet}
          onAcknowledge={() => void acknowledge()}
        />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
          <DemoSyntheticPatientList
            patients={patients}
            canReadPatients={canReadPatients}
            patientsLoading={patientsLoading}
            patientsError={patientsError}
            selectedId={selectedId}
            onRefresh={() => void refreshPatients()}
            onSelect={selectPatient}
          />

          <section className="min-w-0" aria-live="polite">
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
          </section>
        </div>
        <footer className="mt-8 border-t border-[#d4ddd1] pt-4 text-center text-[11px] leading-5 text-[#829083]">
          MPM demonstration environment · server-authorized, synthetic-only, revocable · never a substitute for verified professional access
        </footer>
      </div>
    </main>
  );
}
