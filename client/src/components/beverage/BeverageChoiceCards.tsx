import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { safeLocalStorageSet } from "@/lib/safeLocalStorage";

type BeverageChoice = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  ingredients: any[];
  nutrition?: Record<string, number>;
  servings?: number;
  servingSize?: string;
  [key: string]: any;
};

export function readBeverageChoiceResponse(data: any): BeverageChoice[] {
  if (!Array.isArray(data?.choices) || !data.choices.length || data.choices.length > 3 ||
      data.choices.some((choice: any) => !choice || typeof choice.id !== "string" ||
        !choice.id || typeof choice.name !== "string" || !choice.name.trim() ||
        !Array.isArray(choice.ingredients) || !choice.ingredients.length) ||
      new Set(data.choices.map((choice: any) => choice.id)).size !== data.choices.length) {
    throw new Error("The beverage choices could not be loaded. Please try again.");
  }
  return data.choices;
}

// Working sets belong only to these beverage pages and the current account.
// Selected recipes still use each page's existing detailed result/actions.
export function useBeverageChoices(
  creator: "beverage" | "athlete",
  userId: string | undefined,
  selected: any,
  setSelected: Dispatch<SetStateAction<any>>,
) {
  const storageKey = userId ? `mpm_${creator}_beverage_choices:${userId}` : null;
  const load = (key: string | null) => {
    try {
      if (!key) return { owner: key, choices: [] as BeverageChoice[], notice: "", selectedId: null as string | null };
      const data = JSON.parse(localStorage.getItem(key) || "null");
      return {
        owner: key, choices: readBeverageChoiceResponse(data), notice: String(data.choiceNotice || ""),
        selectedId: typeof data.selectedId === "string" ? data.selectedId : null,
      };
    } catch {
      return { owner: key, choices: [] as BeverageChoice[], notice: "", selectedId: null as string | null };
    }
  };
  const [batch, setBatch] = useState(() => load(storageKey));
  const ownerKey = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (ownerKey.current === storageKey) return;
    ownerKey.current = storageKey;
    const restored = load(storageKey);
    setBatch(restored);
    setSelected((previous: any) => {
      if (restored.choices.length) {
        return restored.choices.find((choice) => choice.id === restored.selectedId) ?? null;
      }
      return previous?.id?.startsWith("beverage-choice-") ? null : previous;
    });
  }, [storageKey, setSelected]);
  useEffect(() => {
    if (!storageKey || batch.owner !== storageKey) return;
    if (batch.choices.length) {
      safeLocalStorageSet(storageKey, {
        choices: batch.choices, choiceNotice: batch.notice, selectedId: batch.selectedId,
      });
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [batch, storageKey]);
  useEffect(() => {
    if (!selected?.id || batch.owner !== storageKey) return;
    setBatch((previous) => {
      const current = previous.choices.find((choice) => choice.id === selected.id);
      if (!current || (current === selected && previous.selectedId === selected.id)) return previous;
      return { ...previous, selectedId: selected.id, choices: previous.choices.map((choice) =>
        choice.id === selected.id ? selected : choice) };
    });
  }, [selected, batch.owner, storageKey]);
  const replaceChoices = (data: any) => {
    const choices = readBeverageChoiceResponse(data);
    if (ownerKey.current !== storageKey) return;
    setBatch({ owner: storageKey, choices, notice: String(data.choiceNotice || ""), selectedId: null });
    setSelected(null);
  };
  const clearChoices = () => {
    setBatch({ owner: storageKey, choices: [], notice: "", selectedId: null });
    setSelected(null);
  };
  return {
    choices: batch.owner === storageKey ? batch.choices : [],
    choiceNotice: batch.owner === storageKey ? batch.notice : "",
    replaceChoices, clearChoices,
  };
}

export default function BeverageChoiceCards({
  choices,
  selectedId,
  notice,
  disabled = false,
  onSelect,
}: {
  choices: BeverageChoice[];
  selectedId?: string;
  notice?: string;
  disabled?: boolean;
  onSelect: (choice: BeverageChoice) => void;
}) {
  if (!choices.length) return null;
  return (
    <section aria-label="Beverage choices" className="space-y-3 mb-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Choose your drink</h2>
        <p className="text-sm text-white/70">
          Compare your options, then select a drink to see its full recipe and actions.
        </p>
        {notice && <p role="status" className="mt-2 text-sm text-amber-200">{notice}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {choices.map((choice) => (
          <article key={choice.id} data-testid="beverage-choice-card"
            className={`rounded-2xl border p-4 bg-black/40 ${selectedId === choice.id
              ? "border-lime-400" : "border-white/20"}`}>
            {choice.imageUrl && (
              <img src={choice.imageUrl} alt={choice.name}
                className="w-full aspect-video object-cover rounded-xl mb-3"
                onError={(event) => { event.currentTarget.style.display = "none"; }} />
            )}
            <h3 className="font-semibold text-white">{choice.name}</h3>
            <p className="mt-2 text-sm text-white/70">{choice.description}</p>
            <p className="mt-2 text-xs text-white/60">
              {choice.servingSize || `${choice.servings || 1} serving(s)`} · {choice.nutrition?.calories ?? "—"} kcal total
            </p>
            <button type="button" aria-pressed={selectedId === choice.id} disabled={disabled}
              onClick={() => onSelect(choice)}
              className="mt-3 w-full rounded-xl bg-lime-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {selectedId === choice.id ? "Selected" : `Choose ${choice.name}`}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}