import { useGLP1CurrentUse } from "@/hooks/useGLP1CurrentUse";
import { Button } from "@/components/ui/button";

export function GLP1CurrentUseControl() {
  const { data, isLoading, isError, refetch, save } = useGLP1CurrentUse();
  if (!import.meta.env.DEV) return null;
  return (
    <section className="rounded-xl border border-white/15 p-4 space-y-3" aria-label="Current GLP-1 medication use">
      <h3 className="font-semibold text-white">Current GLP-1 medication use</h3>
      <p id="glp1-current-use-help" className="text-sm text-white/70">
        Are you currently taking a GLP-1 medication, such as Ozempic, Wegovy, or Mounjaro?
        This records your report, not a prescription. Changes save immediately.
      </p>
      {isLoading ? <p role="status">Loading medication status…</p> : isError || !data ? (
        <div role="alert">Medication status unavailable. <Button type="button" onClick={() => refetch()}>Retry</Button></div>
      ) : (
        <>
          <button type="button" role="switch" aria-checked={data.memberReportedCurrentUse}
            aria-describedby="glp1-current-use-help" disabled={save.isPending}
            onClick={() => save.mutate(!data.memberReportedCurrentUse)}
            className="rounded-full border border-white/30 px-4 py-2 text-white disabled:opacity-50">
            My current medication use: {data.memberReportedCurrentUse ? "On" : "Off"}
          </button>
          <p className="text-sm text-white/70" role="status">
            {save.isPending ? "Saving…" : data.effectiveActive ? "GLP-1 meal guidance is active." : "GLP-1 meal guidance is not active."}
          </p>
          {data.physicianManaged && <p className="text-sm text-orange-200">
            Your care team also manages GLP-1 guidance. Turning your report Off does not disable their guidance or change their records.
          </p>}
          {!data.memberReportedCurrentUse && data.builderActive && <p className="text-sm text-white/70">
            The Metabolic Builder still applies its own meal guidance.
          </p>}
          {data.otherMedicationActive && <p className="text-sm text-white/70">
            Another current medication record also keeps GLP-1 guidance active; this switch does not change that record.
          </p>}
        </>
      )}
      {save.isError && <p role="alert" className="text-sm text-red-200">Your change could not be confirmed. Please retry.</p>}
    </section>
  );
}
