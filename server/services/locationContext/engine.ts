import { VENUE_CATALOG, getVenueById, getZoneById } from "../../data/venueCatalog";
import type { Venue, VenueZone, LocationContext, LocationConfidence, VenueSearchResult } from "./types";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
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
