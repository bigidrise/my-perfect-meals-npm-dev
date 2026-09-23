import type { OneTouchConcept } from "@shared/oneTouch";

interface Props {
  concepts: OneTouchConcept[];
  choosingId: string | null;
  generating: boolean;
  onChoose: (id: string) => void;
  onTryMore: () => void;
  onClear: () => void;
}

export function CreatorConceptCards({
  concepts, choosingId, generating, onChoose, onTryMore, onClear,
}: Props) {
  if (concepts.length !== 3) return null;
  return (
    <section className="mt-8 space-y-4" aria-label="Your three Menu ideas">
      <h3 className="text-lg font-bold text-white">Choose from 3 ideas</h3>
      {concepts.map((concept) => (
        <article key={concept.id} className="rounded-2xl border border-white/20 bg-black/30 p-5 text-white">
          <h4 className="font-bold text-lg">{concept.title}</h4>
          <p className="mt-1 text-sm text-white/75">{concept.description}</p>
          <p className="mt-2 text-xs text-white/60">
            {[concept.cuisine, concept.preparationMethod].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-xs text-white/70">
            Main ingredients: {concept.primaryIngredients.join(", ")}
          </p>
          <button type="button" disabled={Boolean(choosingId) || generating}
            onClick={() => onChoose(concept.id)}
            className="mt-4 min-h-11 rounded-xl bg-lime-600 px-5 font-semibold text-white disabled:opacity-50">
            {choosingId === concept.id ? "Completing your recipe…" : "Choose This"}
          </button>
        </article>
      ))}
      <div className="flex gap-4">
        <button type="button" disabled={Boolean(choosingId) || generating} onClick={onTryMore}
          className="min-h-11 rounded-xl border border-white/30 px-4 font-semibold text-white disabled:opacity-50">
          {generating ? "Creating more ideas…" : "Try 3 More"}
        </button>
        <button type="button" disabled={Boolean(choosingId) || generating} onClick={onClear}
          className="min-h-11 px-3 text-sm text-white/70 disabled:opacity-50">Start over</button>
      </div>
    </section>
  );
}