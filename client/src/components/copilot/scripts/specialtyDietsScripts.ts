export interface SpecialtyDietScript {
  id: string;
  title: string;
  spokenText: string;
}

export const SPECIALTY_DIET_SCRIPTS: Record<string, SpecialtyDietScript> = {
  protocol_active: {
    id: "protocol_active",
    title: "Dietary Protocol Active",
    spokenText:
      "Your meals are being generated inside your selected dietary protocol. Ingredients, combinations, and cooking instructions are checked before and after creation to reduce guesswork and help you make more confident choices.",
  },

  how_it_works: {
    id: "how_it_works",
    title: "How the Protocol System Works",
    spokenText:
      "My Perfect Meals enforces your dietary identity at three levels. First, ingredient level, forbidden ingredients are blocked before anything is generated. Second, combination level, foods that cannot be combined under your protocol, like meat and dairy for kosher users, are detected and prevented. Third, preparation level, cooking steps are scanned for phrases that would violate your protocol, such as deglazing with wine for halal users or finishing a meat dish with butter for kosher users. Your dietary identity is always the outermost rule. Nothing, no craving, no health goal, no flavor preference, can override it.",
  },

  sources_note: {
    id: "sources_note",
    title: "Protocol Sources",
    spokenText:
      "This system's dietary protocol rules are informed by recognized certification guidance from organizations such as the Orthodox Union, Star-K, OK Kosher, and the Islamic Food and Nutrition Council of America. For strict religious adherence, always follow the guidance of your local religious authority.",
  },
};
