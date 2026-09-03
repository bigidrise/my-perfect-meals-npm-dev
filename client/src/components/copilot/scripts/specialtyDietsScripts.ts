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
      "Your meals are being built inside your dietary protocol right now. Every ingredient, every combination, and every cooking step gets checked before and after creation. You don't have to second-guess anything. I've got it covered.",
  },

  how_it_works: {
    id: "how_it_works",
    title: "How the Protocol System Works",
    spokenText:
      "Here's how I protect your protocol. Before anything gets created, I check every ingredient against your dietary rules. If it doesn't belong, it never makes it in. Second, I check combinations. For kosher users, that means catching meat and dairy in the same dish. For others, it means checking every pairing. Third, I scan the actual cooking steps, things like a wine reduction for halal users, or finishing a meat dish with butter for kosher users. Every instruction gets reviewed. Your dietary identity is the outermost rule. Nothing overrides it, not a craving, not a health goal, not a flavor preference. It's always protected.",
  },

  sources_note: {
    id: "sources_note",
    title: "Protocol Sources",
    spokenText:
      "Our dietary protocol rules are informed by guidance from organizations like the Orthodox Union, Star-K, OK Kosher, and the Islamic Food and Nutrition Council of America. That said, for strict religious practice, always follow your local religious authority. We inform. They confirm.",
  },
};
