import { VENUE_CATALOG, getVenueById, getZoneById } from "../../data/venueCatalog";
import type { Venue, VenueZone, LocationContext, LocationConfidence, VenueSearchResult } from "./types";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

/** Identity matching, not category matching. Used by approved Getaway discovery. */
export function normalizeVenueIdentity(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const SEARCH_FILLER = new Set(("a an and at am are can could dine dining eat eating find food for from going help " +
  "here how i im in is me my next of on options please recommend restaurants should some the to us we week what where with would nearby near you tell figure out").split(" "));

export function venueIdentityTokens(text: string): string[] {
  return normalizeVenueIdentity(text).split(/\s+/).filter(token => token && !SEARCH_FILLER.has(token));
}

/** Bounded conversational wrapper removal, not a guessed venue or geocoder.
 * Keep location qualifiers and conflicting names; discard only a separate
 * first-person food/help clause. In particular, do not split St. Louis or U.K. */
export function venueSearchIdentity(text: string): string {
  return text.trim()
    .replace(/^(?:i(?:['’]m| am)|we(?:['’]re| are))\s+(?:currently\s+)?(?:at|in)\s+/i, "")
    .split(/(?:[.!?;]\s+|,\s*(?:and\s+)?)(?=(?:i|im|we|what|where|can|could|how)\b)/i)[0]
    .replace(/\s+and\s+(?:i(?:['’]m| am)\s+)?hungry\b.*$/i, "")
    .trim();
}

/** Equivalent country spellings only, not geographic inference (e.g. England
 * is not interchangeable with every location in the UK). */
export function venueLookupTokens(text: string): string[] {
  // Preserve uppercase country US without turning conversational "help us"
  // into a country constraint; lower-case "us" remains ordinary filler.
  const canonical = normalizeVenueIdentity(text.replace(/\bUS\b/g, "unitedstates"))
    .replace(/\b(?:united kingdom|great britain|u k)\b/g, "uk")
    .replace(/\b(?:united states(?: of america)?|u s a|u s|usa)\b/g, "unitedstates")
    .replace(/\b(?:united arab emirates|u a e)\b/g, "uae");
  return venueIdentityTokens(canonical);
}

export function hasNamedVenueIdentity(text: string): boolean {
  const categories = new Set(["airport", "terminal", "international", "hotel", "resort", "cruise",
    "ship", "theme", "park", "stadium", "arena", "state", "fair", "restaurant", "city", "location", "venue"]);
  return venueIdentityTokens(text).some(token => !categories.has(token));
}

export function findVenueByIdentity(text: string): VenueSearchResult | null {
  const identity = venueSearchIdentity(text);
  const query = ` ${normalizeVenueIdentity(identity)} `;
  if (!hasNamedVenueIdentity(identity)) return null;
  const requested = venueLookupTokens(identity);
  const matches = VENUE_CATALOG.filter(venue => {
    if (!venue.active) return false;
    const identities = [venue.name, ...venue.aliases].map(normalizeVenueIdentity);
    if (!identities.some(identity => identity && query.includes(` ${identity} `))) return false;
    const supported = new Set(venueLookupTokens([
      venue.name, ...venue.aliases, venue.city, venue.state,
      ...venue.zones.filter(zone => zone.active).map(zone => zone.name),
    ].join(" ")));
    return requested.every(token => supported.has(token));
  });
  // More than one plausible identity is uncertainty, never catalog ordering.
  return matches.length === 1 ? { venue: matches[0] } : null;
}

export function findVenueByText(text: string): VenueSearchResult | null {
  const norm = normalize(text);
  if (!norm) return null;

  for (const venue of VENUE_CATALOG) {
    if (!venue.active) continue;

    if (normalize(venue.name) === norm) {
      return { venue };
    }

    for (const alias of venue.aliases) {
      if (normalize(alias) === norm) {
        return { venue, matchedAlias: alias };
      }
    }
  }

  for (const venue of VENUE_CATALOG) {
    if (!venue.active) continue;

    if (normalize(venue.name).includes(norm) || norm.includes(normalize(venue.name))) {
      return { venue };
    }

    for (const alias of venue.aliases) {
      const normAlias = normalize(alias);
      if (normAlias.includes(norm) || norm.includes(normAlias)) {
        return { venue, matchedAlias: alias };
      }
    }
  }

  for (const venue of VENUE_CATALOG) {
    if (!venue.active) continue;

    for (const kw of venue.searchKeywords) {
      if (norm.includes(normalize(kw))) {
        return { venue };
      }
    }
  }

  return null;
}

export function assembleLocationContext(
  venueId: string,
  zoneId?: string,
  confidence: LocationConfidence = "high",
  confidenceReason = "User selected venue and zone"
): LocationContext | null {
  const venue = getVenueById(venueId);
  if (!venue) return null;

  const zone = zoneId ? (getZoneById(venueId, zoneId) ?? null) : null;

  return { venue, zone, confidence, confidenceReason };
}

export function buildVenueAwareSearchQuery(context: LocationContext): string {
  const { venue, zone } = context;

  if (zone) {
    const zoneTypeLabel = zone.type.charAt(0).toUpperCase() + zone.type.slice(1);
    return `restaurants in ${venue.name} ${zoneTypeLabel} ${zone.name}`;
  }

  return `restaurants at ${venue.name}`;
}

export function buildVenueContextBlock(context: LocationContext): string {
  const { venue, zone, confidence } = context;
  const lines: string[] = [];

  lines.push(`LOCATION CONTEXT (confidence: ${confidence}):`);
  lines.push(`Venue: ${venue.name}`);
  lines.push(`Type: ${venue.type.replace("_", " ")}`);

  if (zone) {
    const zoneTypeLabel = zone.type.charAt(0).toUpperCase() + zone.type.slice(1);
    lines.push(`${zoneTypeLabel}: ${zone.name}`);
    if (zone.notes) {
      lines.push(`Zone notes: ${zone.notes}`);
    }
    lines.push(`Search precision: Terminal/zone-level — recommendations should reflect what is specifically available in ${zone.name}`);
  } else {
    lines.push(`Zone: Not specified — give general venue recommendations`);
  }

  return lines.join("\n");
}

export function getVenuesPublicPayload(): Array<{
  id: string;
  name: string;
  type: string;
  aliases: string[];
  zones: Array<{ id: string; name: string; type: string }>;
}> {
  return VENUE_CATALOG
    .filter(v => v.active)
    .map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      aliases: v.aliases,
      zones: v.zones
        .filter(z => z.active)
        .map(z => ({ id: z.id, name: z.name, type: z.type })),
    }));
}
