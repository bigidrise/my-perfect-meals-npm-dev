import type { DemoCapability, DemoContext, DemoPatient, DemoPlan } from "@shared/demoProfessional";

type PatientSummary = Pick<DemoPatient, "id" | "label" | "scenario">;
type PatientDetail = Pick<DemoPatient, "id" | "label" | "scenario" | "glucose" | "plan" | "revision">;
type DemoMessage = DemoPatient["messages"][number];
type MediaItem = Pick<DemoPatient["media"][number], "id" | "name" | "contentType">;
type MediaContent = DemoPatient["media"][number];

function CapabilityTag({ children, active = true }: { children: string; active?: boolean }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? "border-[#a9c3b1] bg-[#edf4ee] text-[#365543]" : "border-[#e0d7c8] bg-[#f5f1e8] text-[#827660]"}`}>{children}</span>;
}

const focusLabels: Record<DemoPlan["nutritionFocus"], string> = {
  balanced_meals: "Build balanced meals",
  carb_awareness: "Practice carbohydrate awareness",
  hydration_routine: "Establish a hydration routine",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ErrorPanel({ title, error, retry }: { title: string; error: string; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#d8b9a6] bg-[#fbf0e9] p-4 text-[#653d2c]" role="alert">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 break-words text-sm leading-6">{error}</p>
      <button type="button" onClick={retry} className="mt-3 rounded-lg border border-[#c99579] px-3 py-2 text-sm font-semibold hover:bg-[#f7e5da] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a5c3c]">Try again</button>
    </div>
  );
}

export function DemoPhysicianHeader({ context, acknowledged, ackBusy, ackError, capabilities, onAcknowledge }: {
  context: DemoContext;
  acknowledged: boolean;
  ackBusy: boolean;
  ackError: string;
  capabilities: Set<DemoCapability>;
  onAcknowledge: () => void;
}) {
  return (
    <>
      <header className="relative overflow-hidden rounded-[1.75rem] bg-[#294b3b] px-5 py-6 text-[#f4f2e7] shadow-[0_18px_44px_rgba(38,67,51,0.12)] sm:px-8 sm:py-8">
        <div className="absolute -right-8 -top-16 h-64 w-64 rounded-full border border-[#66816d]/50" aria-hidden="true" />
        <div className="absolute -right-1 top-4 h-40 w-40 rounded-full border border-[#66816d]/35" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c8d6be]">MPM · adaptive nutrition</p>
            <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight sm:text-5xl">Physician demonstration</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d4dfd1]">A contained walkthrough using synthetic cases. Explore a nutrition plan, not a real clinical record.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="rounded-full border border-[#c2d2bf]/40 bg-[#44624e] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#edf2e5]">Demo only · physician persona</span>
            <span className="text-xs text-[#c8d6be]">Workspace: {context.workspace.label}</span>
          </div>
        </div>
      </header>

      <section className="mt-5 rounded-2xl border border-[#d4a68c] bg-[#f8e9de] px-4 py-4 sm:px-5" aria-label="Demonstration boundary">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#925539]">Synthetic data only · not real physician verification</p>
            <p className="mt-1 text-sm leading-6 text-[#704631]">This access does not establish real clinical readiness, credential verification, academy completion, professional agreements, or paid subscription. Do not enter or infer real patient information.</p>
            {context.grant.trainingBasis === "demo_only_waiver" ? (
              <p className="mt-2 text-xs leading-5 text-[#85543a]"><strong>Training basis:</strong> demo-only waiver — {context.grant.trainingWaiverReason || "No waiver reason supplied."}</p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-[#85543a]"><strong>Training basis:</strong> academy evidence; this is not proof of clinical readiness.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 md:items-end">
            <span className="rounded-full border border-[#d8bda9] bg-[#fcf5ef] px-3 py-1.5 text-xs font-semibold text-[#704631]">Expires {formatDate(context.grant.expiresAt)}</span>
            {acknowledged ? (
              <span className="text-xs font-semibold text-[#476b4f]">Demo-only acknowledgment recorded</span>
            ) : (
              <button type="button" onClick={onAcknowledge} disabled={ackBusy} className="rounded-xl bg-[#9b5b3b] px-4 py-2.5 text-sm font-bold text-[#fff8ef] hover:bg-[#82482d] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b5b3b]">
                {ackBusy ? "Recording acknowledgment…" : "Acknowledge demo-only use"}
              </button>
            )}
          </div>
        </div>
        {ackError && <p className="mt-3 text-sm font-medium text-[#8c382e]" role="alert">{ackError}</p>}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.15em] text-[#778378]">Server-granted capabilities</span>
        {(["patient.read", "clinical.read", "clinical.write", "messages.read", "media.read", "export"] as DemoCapability[]).map(capability => (
          <CapabilityTag key={capability} active={capabilities.has(capability)}>{capability}</CapabilityTag>
        ))}
        <span className="ml-auto text-xs text-[#718076]">Grant revision {context.grant.revision}</span>
      </div>

      {!acknowledged && (
        <div className="mt-4 rounded-xl border border-[#d8c9a3] bg-[#f8f3e4] px-4 py-3 text-sm text-[#625533]" role="status">
          Acknowledge the synthetic-only boundary before opening cases or using demo actions.
        </div>
      )}
    </>
  );
}

export function DemoSyntheticPatientList({ patients, canReadPatients, patientsLoading, patientsError, selectedId, onRefresh, onSelect }: {
  patients: PatientSummary[];
  canReadPatients: boolean;
  patientsLoading: boolean;
  patientsError: string;
  selectedId: string;
  onRefresh: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="overflow-hidden rounded-2xl border border-[#d3ddd2] bg-[#fafbf6] shadow-[0_10px_30px_rgba(46,66,49,0.045)]" aria-label="Synthetic case list">
      <div className="flex items-center justify-between border-b border-[#e1e8df] px-4 py-4">
        <div>
          <h2 className="font-semibold">Synthetic cases</h2>
          <p className="mt-0.5 text-xs text-[#7b887d]">{patients.length} available</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={!canReadPatients || patientsLoading} className="rounded-lg border border-[#cbd8ca] px-3 py-2 text-xs font-semibold text-[#3d6047] hover:bg-[#edf3eb] disabled:cursor-not-allowed disabled:opacity-50">
          {patientsLoading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {!canReadPatients ? (
        <div className="px-5 py-8 text-sm leading-6 text-[#78847a]">Patient access is gated by your server-granted capability and demo acknowledgment.</div>
      ) : patientsError ? (
        <div className="p-3"><ErrorPanel title="Could not load synthetic cases" error={patientsError} retry={onRefresh} /></div>
      ) : patientsLoading && patients.length === 0 ? (
        <div className="space-y-2 p-4" aria-label="Loading synthetic cases">{[0, 1, 2].map(index => <div key={index} className="h-[4.5rem] animate-pulse rounded-xl bg-[#e8eee5]" />)}</div>
      ) : patients.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[#cbd8ca] font-serif text-xl text-[#6d886f]" aria-hidden="true">—</div>
          <h3 className="mt-3 font-semibold">No cases in this demo</h3>
          <p className="mt-1 text-sm leading-5 text-[#78847a]">The server has not supplied any synthetic case records.</p>
        </div>
      ) : (
        <ul className="max-h-[72vh] divide-y divide-[#e6ebe3] overflow-y-auto">
          {patients.map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} aria-current={selectedId === item.id ? "true" : undefined} className={`w-full px-4 py-4 text-left transition-colors hover:bg-[#eff4ed] focus-visible:outline focus-visible:outline-inset focus-visible:outline-2 focus-visible:outline-[#66866b] ${selectedId === item.id ? "bg-[#e8f0e7]" : ""}`}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#334a39]">{item.label}</span>
                  <span className="rounded-full bg-[#edf2e7] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#54705a]">Synthetic</span>
                </span>
                <span className="mt-1.5 block text-xs leading-5 text-[#748177]">{item.scenario}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-[#e1e8df] bg-[#f4f6ef] px-4 py-3 text-[11px] leading-5 text-[#7b8678]">Case data is generated and persisted by the demonstration service, not embedded in this interface.</div>
    </aside>
  );
}

export function DemoBlockedScreen({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <main className="min-h-[100dvh] bg-[#f1f3eb] px-4 py-10 text-[#283c32] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-[#cad6c9] pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#66806c]">MPM · Professional demonstration</p>
          <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight sm:text-5xl">Physician workspace</h1>
        </header>
        <section className="mt-8 rounded-[1.75rem] border border-[#d7b5a1] bg-[#fbf0e9] p-6 sm:p-9" role="alert">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5c3c]">No live fallback</p>
          <h2 className="mt-2 font-serif text-3xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#704a38]">{message}</p>
          <p className="mt-4 text-sm font-semibold text-[#704a38]">No patient, clinical, messaging, media, or export data is available until the server authorizes a valid demo-only context.</p>
          <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-[#315643] px-4 py-3 text-sm font-semibold text-[#f4f4e8] hover:bg-[#244633] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315643]">Retry authorization</button>
        </section>
      </div>
    </main>
  );
}

interface DemoSyntheticPatientViewProps {
  selectedSummary?: PatientSummary;
  patient: PatientDetail | null;
  detailLoading: boolean;
  detailError: string;
  onRetryDetail: () => void;
  canReadClinical: boolean;
  canWriteClinical: boolean;
  canReadMessages: boolean;
  canReadMedia: boolean;
  canExport: boolean;
  planFocus: DemoPlan["nutritionFocus"];
  onPlanFocusChange: (value: DemoPlan["nutritionFocus"]) => void;
  followupDays: string;
  onFollowupDaysChange: (value: string) => void;
  planDirty: boolean;
  planBusy: boolean;
  planError: string;
  planSaved: boolean;
  onSavePlan: () => void;
  messages: DemoMessage[];
  media: MediaItem[];
  onOpenMedia: (item: MediaItem) => void;
  mediaBusyId: string;
  mediaError: string;
  readingMedia: MediaContent | null;
  onCloseMedia: () => void;
  exportBusy: boolean;
  exportError: string;
  exportDone: boolean;
  onExport: () => void;
}

export default function DemoSyntheticPatientView({
  selectedSummary, patient, detailLoading, detailError, onRetryDetail,
  canReadClinical, canWriteClinical, canReadMessages, canReadMedia, canExport,
  planFocus, onPlanFocusChange, followupDays, onFollowupDaysChange, planDirty,
  planBusy, planError, planSaved, onSavePlan, messages, media, onOpenMedia,
  mediaBusyId, mediaError, readingMedia, onCloseMedia, exportBusy,
  exportError, exportDone, onExport,
}: DemoSyntheticPatientViewProps) {
  if (!selectedSummary && !detailLoading) {
    return (
      <div className="grid min-h-[26rem] place-items-center rounded-2xl border border-dashed border-[#bfcebf] bg-[#f7f8f2] p-8 text-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7a8b7c]">Contained clinical simulation</p>
          <h2 className="mt-2 font-serif text-3xl">Choose a synthetic case</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#778378]">The case details, readings, messages, and media will be retrieved from the demo service only.</p>
        </div>
      </div>
    );
  }
  if (detailLoading) {
    return (
      <div className="space-y-4" aria-label="Loading synthetic case">
        <div className="h-40 animate-pulse rounded-2xl bg-[#dfe8dc]" />
        <div className="h-72 animate-pulse rounded-2xl bg-[#e5ece2]" />
      </div>
    );
  }
  if (detailError) return <ErrorPanel title="Unable to load synthetic case" error={detailError} retry={onRetryDetail} />;
  if (selectedSummary && !canReadClinical && !patient) {
    return (
      <div className="rounded-2xl border border-[#d3ddd2] bg-[#fafbf6] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#748575]">Synthetic case · {selectedSummary.id}</p>
        <h2 className="mt-1 font-serif text-3xl font-medium tracking-tight">{selectedSummary.label}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f7c70]">{selectedSummary.scenario}</p>
        <p className="mt-5 rounded-xl border border-[#e0d4bd] bg-[#f7f2e8] p-4 text-sm leading-6 text-[#786a4e]">Your active demo grant does not include <code className="font-mono text-xs">clinical.read</code>. Clinical details are not requested or displayed.</p>
      </div>
    );
  }
  if (!patient) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d3ddd2] bg-[#fafbf6] p-5 shadow-[0_10px_30px_rgba(46,66,49,0.045)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#748575]">Synthetic case · {patient.id}</p>
            <h2 className="mt-1 font-serif text-3xl font-medium tracking-tight">{patient.label}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f7c70]">{patient.scenario}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${canReadClinical ? "bg-[#e7f0e5] text-[#3c6545]" : "bg-[#f3ede1] text-[#776448]"}`}>
            {canReadClinical ? "Synthetic record" : "Clinical read unavailable"}
          </span>
        </div>
        {!canReadClinical ? (
          <div className="mt-5 rounded-xl border border-[#e0d4bd] bg-[#f7f2e8] p-4 text-sm leading-6 text-[#786a4e]">Your active demo grant does not include <code className="font-mono text-xs">clinical.read</code>; readings and the saved plan are withheld.</div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#e2e8df] pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#778578]">Glucose readings</p>
                <h3 className="mt-1 font-serif text-2xl">A simple reading log</h3>
              </div>
              <span className="text-xs text-[#899387]">Synthetic readings · mg/dL</span>
            </div>
            {patient.glucose.length ? (
              <ul className="mt-2 divide-y divide-[#e8ece5]">
                {patient.glucose.map(reading => (
                  <li key={reading.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 py-3">
                    <span className="text-sm font-medium text-[#435648]">{reading.context === "FASTED" ? "Fasted" : "Two hours after meal"}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-[#294b3b]">{reading.value} <span className="font-sans text-xs font-normal text-[#778579]">{reading.unit}</span></span>
                    <time className="w-full text-xs text-[#879187] sm:w-auto">{formatDate(reading.recordedAt)}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="py-5 text-sm text-[#7c897d]">No glucose readings were supplied for this synthetic case.</p>}
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8df] pt-3 text-[11px] text-[#8a958a]">
          <span>Demo record revision {patient.revision}</span>
          <span>Not real patient data</span>
        </div>
      </section>

      {canReadClinical && (
        <section className="rounded-2xl border border-[#cbd9ca] bg-[#f8faf4] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#748575]">Structured demo plan</p>
              <h3 className="mt-1 font-serif text-2xl">Nutrition focus & follow-up</h3>
              <p className="mt-1 text-sm text-[#788579]">Save a simulated plan to this synthetic record.</p>
            </div>
            <span className="rounded-full border border-[#d6e0d2] bg-[#edf3e9] px-3 py-1.5 text-xs font-semibold text-[#4e6b51]">Persisted demo data</span>
          </div>
          {canWriteClinical ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className="block text-sm font-semibold text-[#465b49]">
                Nutrition focus
                <select value={planFocus} onChange={event => onPlanFocusChange(event.target.value as DemoPlan["nutritionFocus"])} className="mt-2 min-h-12 w-full rounded-xl border border-[#cbd8ca] bg-[#fffefa] px-3 text-sm font-medium text-[#344a39] focus:border-[#66866b] focus:outline-none focus:ring-2 focus:ring-[#66866b]/20">
                  {Object.entries(focusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[#465b49]">
                Follow-up in days
                <input type="number" min={1} max={30} step={1} value={followupDays} onChange={event => onFollowupDaysChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#cbd8ca] bg-[#fffefa] px-3 text-sm font-mono text-[#344a39] focus:border-[#66866b] focus:outline-none focus:ring-2 focus:ring-[#66866b]/20" />
              </label>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button type="button" onClick={onSavePlan} disabled={planBusy || !planDirty} className="rounded-xl bg-[#315643] px-4 py-3 text-sm font-semibold text-[#f4f4e8] hover:bg-[#244633] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315643]">
                  {planBusy ? "Saving plan…" : "Save demo plan"}
                </button>
                {patient.plan && <span className="text-xs text-[#798679]">Current: {focusLabels[patient.plan.nutritionFocus]} · follow-up {patient.plan.followupDays} days</span>}
                {planSaved && <span className="text-sm font-semibold text-[#426e4c]" role="status">Plan saved to the synthetic case.</span>}
                {planError && <span className="text-sm text-[#963f32]" role="alert">{planError}</span>}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-[#e0d4bd] bg-[#f7f2e8] p-4 text-sm leading-6 text-[#786a4e]">Plan changes are unavailable: your server-granted capabilities do not include <code className="font-mono text-xs">clinical.write</code>.</p>
          )}
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#d3ddd2] bg-[#fafbf6] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#748575]">Case conversation</p>
              <h3 className="mt-1 font-serif text-2xl">Synthetic messages</h3>
            </div>
            <span className="text-xs text-[#879287]">{canReadMessages ? `${messages.length} messages` : "Restricted"}</span>
          </div>
          {!canReadMessages ? (
            <p className="mt-4 rounded-xl bg-[#f3f3ec] p-4 text-sm leading-6 text-[#7b867a]">Messaging access is not included in this grant.</p>
          ) : messages.length ? (
            <ol className="mt-4 space-y-3">
              {messages.map(message => (
                <li key={message.id} className="rounded-xl border border-[#e0e7dd] bg-[#f5f7f0] p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-bold text-[#48624c]">{message.author}</span><span className="font-mono text-[#a0a99d]">DEMO</span></div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b5b4d]">{message.text}</p>
                </li>
              ))}
            </ol>
          ) : <p className="mt-4 rounded-xl bg-[#f3f3ec] p-4 text-sm leading-6 text-[#7b867a]">No messages were supplied for this synthetic case.</p>}
        </section>

        <section className="rounded-2xl border border-[#d3ddd2] bg-[#fafbf6] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#748575]">Attachments</p>
              <h3 className="mt-1 font-serif text-2xl">Text-file viewer</h3>
            </div>
            <span className="text-xs text-[#879287]">{canReadMedia ? `${media.length} files` : "Restricted"}</span>
          </div>
          {!canReadMedia ? (
            <p className="mt-4 rounded-xl bg-[#f3f3ec] p-4 text-sm leading-6 text-[#7b867a]">Media access is not included in this grant.</p>
          ) : media.length ? (
            <ul className="mt-4 space-y-2">
              {media.map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e7dd] bg-[#f5f7f0] px-3 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-[#475d4a]">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#849084]">{item.contentType}</p>
                  </div>
                  <button type="button" onClick={() => onOpenMedia(item)} disabled={Boolean(mediaBusyId)} className="shrink-0 rounded-lg border border-[#cbd8ca] px-3 py-2 text-xs font-semibold text-[#3e6047] hover:bg-[#e9f0e6] disabled:opacity-50">
                    {mediaBusyId === item.id ? "Opening…" : "View text"}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 rounded-xl bg-[#f3f3ec] p-4 text-sm leading-6 text-[#7b867a]">No text files were supplied for this synthetic case.</p>}
          {mediaError && <p className="mt-3 text-sm text-[#963f32]" role="alert">{mediaError}</p>}
          {readingMedia && (
            <div className="mt-4 rounded-xl border border-[#cbd8ca] bg-[#f2f5ee] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="break-words text-sm font-semibold">{readingMedia.name}</p><p className="text-[11px] text-[#7e8b7e]">Plain text · synthetic file</p></div>
                <button type="button" onClick={onCloseMedia} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#617562] hover:bg-[#e4ece1]">Close</button>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#e9eee5] p-3 font-mono text-xs leading-5 text-[#445547]">{readingMedia.content}</pre>
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-[#d3ddd2] bg-[#f8faf4] p-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#748575]">Synthetic record export</p>
          <h3 className="mt-1 font-serif text-2xl">Download a JSON copy</h3>
          <p className="mt-1 text-sm leading-6 text-[#788579]">The demo service returns the export object; it is downloaded locally as a .json file.</p>
          {exportDone && <p className="mt-2 text-sm font-semibold text-[#426e4c]" role="status">Synthetic export downloaded.</p>}
          {exportError && <p className="mt-2 text-sm text-[#963f32]" role="alert">{exportError}</p>}
        </div>
        <button type="button" onClick={onExport} disabled={!canExport || exportBusy} className="shrink-0 rounded-xl border border-[#a9c3b1] bg-[#e9f1e7] px-4 py-3 text-sm font-bold text-[#365543] hover:bg-[#dce9d9] disabled:cursor-not-allowed disabled:opacity-45">
          {exportBusy ? "Preparing export…" : canExport ? "Export synthetic case" : "Export not granted"}
        </button>
      </section>
    </div>
  );
}
