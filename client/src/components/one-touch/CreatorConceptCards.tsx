import type { OneTouchConcept } from "@shared/oneTouch";

interface Props {
  concepts: OneTouchConcept[];
  choosingId: string | null;
  generating: boolean;
  selectedConceptId?: string | null;
  completedMealVisible?: boolean;
  onChoose: (id: string) => void;
  onTryMore: () => void;
  onClear: () => void;
}

export function CreatorConceptCards({
  concepts, choosingId, generating, selectedConceptId, completedMealVisible,
  onChoose, onTryMore, onClear,
}: Props) {
  if (concepts.length !== 3) return null;
  return (
    <section className="mt-8 space-y-4" aria-label="Your three Menu ideas">
      <h3 className="text-lg font-bold text-white">
        {completedMealVisible ? "Your 3 Menu ideas are still here" : "Choose from 3 ideas"}
      </h3>
      {completedMealVisible && (
        <p className="text-sm text-white/70">
          Explore another idea whenever you like. Save a finished recipe to Favorites before switching meals.
        </p>
      )}
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
          <button type="button" disabled={Boolean(choosingId) || generating || concept.id === selectedConceptId}
            onClick={() => onChoose(concept.id)}
            className="mt-4 min-h-11 rounded-xl bg-lime-600 px-5 font-semibold text-white disabled:opacity-50">
            {choosingId === concept.id ? "Completing your recipe…" :
              concept.id === selectedConceptId ? "Current recipe" : "Choose This"}
          </button>
        </article>
      ))}
      <div className="flex gap-4">
        <button type="button" disabled={Boolean(choosingId) || generating} onClick={onTryMore}
          className="min-h-11 rounded-xl border border-white/30 px-4 font-semibold text-white disabled:opacity-50">
          {generating ? "Creating more ideas…" : "Try 3 More"}
        </button>
        <button type="button" disabled={Boolean(choosingId) || generating} onClick={onClear}
          className="min-h-11 px-3 text-sm text-white/70 disabled:opacity-50">
          {completedMealVisible ? "Remove Menu ideas" : "Start over"}
        </button>
      </div>
    </section>
  );
}