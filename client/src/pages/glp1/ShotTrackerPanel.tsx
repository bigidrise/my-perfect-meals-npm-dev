import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import TrashButton from "@/components/ui/TrashButton";
import {
  useGlp1Shots,
  useCreateShot,
  useUpdateShot,
  useDeleteShot,
  type InjectionLocation,
} from "@/hooks/useGlp1Shots";

const LABEL: Record<InjectionLocation, string> = {
  abdomen: "Abdomen",
  thigh: "Thigh",
  upper_arm: "Upper Arm",
  buttock: "Buttock",
};

export default function ShotTrackerPanel({ onClose, userId }: { onClose: () => void; userId: string }) {
  const shotsQ = useGlp1Shots(userId, { enabled: !!userId }); // mounted by user → fetch
  const createM = useCreateShot(userId);
  const updateM = useUpdateShot(userId);
  const deleteM = useDeleteShot(userId);

  const shots = (shotsQ.data as any[]) ?? [];

  // quick add state
  const [doseMg, setDoseMg] = useState<number>(2.5);
  const [dateLocal, setDateLocal] = useState<string>(() => {
    const d = new Date(); d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [site, setSite] = useState<InjectionLocation | "">("");
  const [notes, setNotes] = useState("");

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDose, setEditDose] = useState<number>(0);
  const [editSite, setEditSite] = useState<InjectionLocation | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [editDateLocal, setEditDateLocal] = useState("");

  const addShot = async () => {
    if (!doseMg || doseMg <= 0) return alert("Enter a valid dose (mg).");
    const asUTC = new Date(dateLocal).toISOString();
    await createM.mutateAsync({
      dateUtc: asUTC,
      doseMg: Number(doseMg),
      location: site || undefined,
      notes: notes?.trim() || undefined,
    });
    setNotes(""); setSite("");
    const d = new Date(); d.setSeconds(0, 0);
    setDateLocal(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditDose(s.doseMg);
    setEditSite(s.location || "");
    setEditNotes(s.notes || "");
    const local = new Date(s.dateUtc);
    setEditDateLocal(new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateM.mutateAsync({
      id: editingId,
      dateUtc: new Date(editDateLocal).toISOString(),
      doseMg: Number(editDose),
      location: editSite || undefined,
      notes: editNotes?.trim() || undefined,
    });
    setEditingId(null);
  };

  const remove = async (id: string) => { await deleteM.mutateAsync(id); };

  const nextHint = useMemo(() => {
    if (shots.length === 0) return "Not scheduled — log your first shot.";
    const last = new Date(shots[0].dateUtc);
    const next = new Date(last); next.setDate(last.getDate() + 7);
    return `Estimated next: ${next.toLocaleDateString()} (${next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }, [shots]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">Shot Tracker</h3>
        <Button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white h-8 px-3 text-xs">
          Close
        </Button>
      </div>

      {shotsQ.isLoading ? (
        <div className="text-white/70 text-sm">Loading…</div>
      ) : shotsQ.error ? (
        <div className="text-red-400 text-sm">Error: {(shotsQ.error as Error).message}</div>
      ) : (
        <>
          {/* Quick Add */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-white/80 text-sm">Dose (mg)</label>
              <input
                type="number" inputMode="decimal" step="0.1" min="0" max="20"
                value={doseMg || ""} onChange={(e) => setDoseMg(Number(e.target.value))}
                placeholder="e.g., 2.5, 5, 7.5, 10, 12.5, 15"
                className="w-full mt-1 rounded-md border border-white/20 bg-black/40 text-white p-2"
              />
            </div>
            <div>
              <label className="text-white/80 text-sm">Date & time</label>
              <input
                type="datetime-local" value={dateLocal}
                onChange={(e) => setDateLocal(e.target.value)}
                className="w-full mt-1 rounded-md border border-white/20 bg-black/40 text-white p-2"
              />
            </div>
            <div>
              <label className="text-white/80 text-sm">Injection Site (optional)</label>
              <select
                value={site}
                onChange={(e) => setSite(e.target.value as any)}
                className="w-full mt-1 rounded-md border border-white/20 bg-black/40 text-white p-2"
              >
                <option value="">Select site…</option>
                <option value="abdomen">Abdomen</option>
                <option value="thigh">Thigh</option>
                <option value="upper_arm">Upper Arm</option>
                <option value="buttock">Buttock</option>
              </select>
            </div>
            <div>
              <label className="text-white/80 text-sm">Notes (optional)</label>
              <input
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., 2 inches from navel"
                className="w-full mt-1 rounded-md border border-white/20 bg-black/40 text-white p-2"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={addShot}
              disabled={createM.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createM.isPending ? "Saving..." : "Save Shot"}
            </Button>
            <div className="text-white/80 text-sm">{nextHint}</div>
          </div>

          {/* History */}
          <div className="bg-black/40 border border-white/15 rounded-xl p-3 mt-4">
            <h4 className="text-white font-semibold mb-2">History</h4>
            {shots.length === 0 ? (
              <div className="text-white/70 text-sm">No shots logged yet.</div>
            ) : (
              <ul className="space-y-2">
                {shots.map((s: any) => (
                  <li key={s.id} className="rounded-lg border border-white/15 p-2 text-white">
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <div className="grid sm:grid-cols-2 gap-2">
                          <input
                            type="number" step="0.1" min="0" max="20"
                            value={editDose}
                            onChange={(e) => setEditDose(Number(e.target.value))}
                            className="rounded-md border border-white/20 bg-black/40 text-white p-2"
                            placeholder="Dose (mg)"
                          />
                          <input
                            type="datetime-local"
                            value={editDateLocal}
                            onChange={(e) => setEditDateLocal(e.target.value)}
                            className="rounded-md border border-white/20 bg-black/40 text-white p-2"
                          />
                        </div>
                        <select
                          value={editSite}
                          onChange={(e) => setEditSite(e.target.value as any)}
                          className="w-full rounded-md border border-white/20 bg-black/40 text-white p-2"
                        >
                          <option value="">Select site…</option>
                          <option value="abdomen">Abdomen</option>
                          <option value="thigh">Thigh</option>
                          <option value="upper_arm">Upper Arm</option>
                          <option value="buttock">Buttock</option>
                        </select>
                        <input
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full rounded-md border border-white/20 bg-black/40 text-white p-2"
                          placeholder="Notes (optional)"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button onClick={() => setEditingId(null)} className="bg-white/10 hover:bg-white/20 text-white h-8 px-3 text-xs">Cancel</Button>
                          <Button onClick={saveEdit} disabled={updateM.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs">
                            {updateM.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-normal truncate flex items-center gap-2">
                            <span>{new Date(s.dateUtc).toLocaleDateString()} — {s.doseMg} mg</span>
                            {s.location && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-600/30 border border-emerald-400/50 text-emerald-300">
                                {LABEL[s.location as InjectionLocation]}
                              </span>
                            )}
                          </div>
                          {s.notes && <div className="text-white/80 text-sm truncate mt-1">{s.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-white/60 text-xs">
                            {new Date(s.dateUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Button onClick={() => startEdit(s)} className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 h-7 text-xs">Edit</Button>
                          <TrashButton
                            onClick={() => remove(s.id)}
                            disabled={deleteM.isPending}
                            size="sm"
                            confirm
                            confirmMessage="Delete this GLP-1 shot log?"
                            ariaLabel="Delete shot"
                            title="Delete shot"
                            data-testid={`button-delete-shot-${s.id}`}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}