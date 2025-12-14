import { useState } from "react";

export type CandidateEntry = {
  name: string;
  qty: number;
  unit: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export function ConfirmEntriesModal({
  open,
  onClose,
  candidates,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  candidates: CandidateEntry[];
  onSave: (rows: CandidateEntry[]) => void;
}) {
  const [rows, setRows] = useState<CandidateEntry[]>(candidates);

  if (!open) return null;

  function update(i: number, patch: Partial<CandidateEntry>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-lg text-white">Confirm Entries</div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">
            ✕
          </button>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm text-white">
            <thead>
              <tr className="text-left border-b border-white/20">
                <th className="p-2">Meal</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Name</th>
                <th className="p-2">Calories</th>
                <th className="p-2">P (g)</th>
                <th className="p-2">C (g)</th>
                <th className="p-2">F (g)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="p-2">
                    <select
                      value={r.meal_type}
                      onChange={(e) => update(i, { meal_type: e.target.value as any })}
                      className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    >
                      <option value="breakfast">breakfast</option>
                      <option value="lunch">lunch</option>
                      <option value="dinner">dinner</option>
                      <option value="snack">snack</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={r.qty}
                      onChange={(e) => update(i, { qty: Number(e.target.value) })}
                      className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={r.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={r.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={r.calories ?? 0}
                      onChange={(e) => update(i, { calories: Number(e.target.value) })}
                      className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={r.protein_g ?? 0}
                      onChange={(e) => update(i, { protein_g: Number(e.target.value) })}
                      className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={r.carbs_g ?? 0}
                      onChange={(e) => update(i, { carbs_g: Number(e.target.value) })}
                      className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={r.fat_g ?? 0}
                      onChange={(e) => update(i, { fat_g: Number(e.target.value) })}
                      className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-white/10 border border-white/20 rounded text-white hover:bg-white/20 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            onClick={() => onSave(rows)}
          >
            Save All
          </button>
        </div>
      </div>
    </div>
  );
}