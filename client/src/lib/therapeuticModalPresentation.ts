interface ModalSource {
  selectedItems: string[];
  activeProtocols: string[];
  priorities: string[];
  body: string;
}
type Copy = (key: string, options?: Record<string, unknown>) => string;
const SAFETY = "Clinical safety requirements always take priority when protocols conflict.";
const englishList = (items: string[]) => items.length === 1 ? items[0]
  : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];

/** Translate only the exact application-owned template; never rewrite an unknown clinical note. */
export function therapeuticModalBody(source: ModalSource, t: Copy, language: string): string {
  if (!source.selectedItems.length) return source.body;
  const selected = englishList(source.selectedItems);
  const protocols = englishList(source.activeProtocols);
  const priorities = source.priorities.length ? source.priorities.join(", ") : "your therapeutic nutrition goals";
  const expected = (source.activeProtocols.length
    ? `You entered ${selected}. Because ${protocols} ${source.activeProtocols.length === 1 ? "is" : "are"} also active, your meals will be built to support: ${source.priorities.join(", ")}.`
    : `You entered ${selected}. Your meals will be built to support: ${priorities}.`) + `\n\n${SAFETY}`;
  if (source.body !== expected) return source.body;
  const list = (items: string[]) => language.split("-")[0] === "es"
    ? new Intl.ListFormat("es", { style: "long", type: "conjunction" }).format(items)
    : englishList(items);
  const translated = source.activeProtocols.length
    ? t("You entered {{selected}}. Because {{protocols}} {{verb}} also active, your meals will be built to support: {{priorities}}.", {
      selected: list(source.selectedItems), protocols: list(source.activeProtocols.map(value => t(value))),
      verb: t(source.activeProtocols.length === 1 ? "is" : "are"),
      priorities: source.priorities.map(value => t(value)).join(", "),
    })
    : t("You entered {{selected}}. Your meals will be built to support: {{priorities}}.", {
      selected: list(source.selectedItems),
      priorities: source.priorities.length ? source.priorities.map(value => t(value)).join(", ") : t("your therapeutic nutrition goals"),
    });
  return `${translated}\n\n${t(SAFETY)}`;
}
