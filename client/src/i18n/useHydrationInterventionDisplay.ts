import { useConsumerCopy } from "./useConsumerCopy";

// Exact built-in catalog identities only. A changed or unknown description is
// kept original. Clinical additions remain verbatim; handoff data is untouched.
const catalog: Record<string, [string, string | null]> = {
  "visible-cue": ["Use a visible cue", "Keep your usual cup or bottle where your next routine starts."],
  "routine-pairing": ["Pair it with something you already do", "Connect a drink with a reliable moment such as breakfast, a commute, or a screen break."],
  "flavor-forward": ["Make it more appealing", "Try a fresh, unsweetened flavor direction that sounds good to you."],
  "alternate-temperature": ["Change the experience", "A different temperature, cup, or straw can make plain fluids easier to return to."],
  "temperature-choice": ["Choose your comfortable temperature", "Keep a cold, room-temperature, or warm option available based on what feels easiest."],
  "sparkling-choice": ["Use a sparkling option", "If bubbles help, choose a plain or unsweetened sparkling beverage that fits your preferences."],
  "two-location-setup": ["Set up a backup location", "Keep a ready-to-use cup or bottle in the place where access usually breaks down."],
  "portable-option": ["Make it portable", "Choose a container that is easy to carry through the part of your day that is hardest."],
  "small-moments": ["Use smaller moments", "Look for a few natural pauses instead of waiting for one large hydration break."],
  "plan-access": ["Plan around access", "Choose times and places where a restroom is available and avoid turning hydration into an emergency."],
  "simple-fluid": ["Keep the choice simple", null],
  "nutrition-aware-drink": ["Create a compatible drink", "Use Beverage Creator for a constrained, preference-aware idea. Any safety checks still apply there."],
  "low-effort-sip": ["Lower the effort", "Keep a comfortable, ready-to-sip option nearby so hydration does not require a full food decision."],
};

export function useHydrationInterventionDisplay() {
  const { t } = useConsumerCopy();
  return (option: { optionKey: string; title: string; description: string }) => {
    const entry = catalog[option.optionKey];
    if (!entry || option.title !== entry[0]) return option;
    const [title, base] = entry;
    const knownBase = base && (option.description === base || option.description.startsWith(`${base} `));
    return {
      ...option, title: t(title),
      description: knownBase ? t(base) + option.description.slice(base.length) : option.description,
    };
  };
}
