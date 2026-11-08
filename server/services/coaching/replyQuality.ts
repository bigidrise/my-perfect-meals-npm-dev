/** Output quality only: never member intent, safety classification or consent. */
const need = "(?:need (?:any )?(?:(?:further|more) )?(?:assistance|help)|have (?:any )?(?:(?:other|more) )?questions)";
const condition = `if you ${need}(?: or ${need})?`;
const invitation = "(?:please )?(?:feel free to (?:ask|reach out)|(?:just )?let me know)";
const emptyClosing = new RegExp(
  `^(?:(?:${condition}) )?${invitation}(?: (?:me|anytime|if you need anything else|${condition}))?$`, "u",
);

export function isGenericClosingSentence(text: string): boolean {
  const words = text.normalize("NFKC").toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return emptyClosing.test(words);
}

function sentences(text: string): string[] {
  // Retain separators so unchanged replies stay byte-for-byte unchanged.
  return text.split(/((?<=[.!?])\s+|\n+)/u);
}

export function containsGenericClosing(text: string): boolean {
  return sentences(text).some(isGenericClosingSentence);
}

/** Reject only complete, content-free sentences, not arbitrary trailing clauses.
 * No punctuation stripping, food routing, source changes or additional AI call.
 * Every retained clause still passes the normal whole-reply screens.
 */
export function projectUsefulReply(text: string): { text: string; rejectedClosings: number } {
  let rejectedClosings = 0;
  const retained = sentences(text).map(part => {
    if (!isGenericClosingSentence(part)) return part;
    rejectedClosings++;
    return "";
  }).join("");
  return { text: rejectedClosings ? retained.trim() : text, rejectedClosings };
}
