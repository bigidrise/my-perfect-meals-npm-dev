import axios from "axios";
import { findVenueByText, findVenueByIdentity, hasNamedVenueIdentity, venueLookupTokens, venueSearchIdentity } from "./engine";
import type { VenueType } from "./types";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const CACHE_TTL = 24 * 60 * 60 * 1000;

const discoveryCache = new Map<string, { result: VenueDiscoveryResult; ts: number }>();

export interface DiscoveredZone {
  id: string;
  name: string;
  type: string;
}

export interface VenueDiscoveryResult {
  source: "catalog" | "google" | "none";
  found: boolean;
  venueId?: string;
  placeId?: string;
  name: string;
  type: VenueType;
  address?: string;
  coordinates?: { lat: number; lng: number };
  zones: DiscoveredZone[];
  confidence: "high" | "medium" | "low";
  uncertainty?: string;
}

function classifyVenueType(googleTypes: string[]): VenueType {
  if (googleTypes.includes("airport")) return "airport";
  if (googleTypes.includes("amusement_park")) return "theme_park";
  if (googleTypes.includes("stadium")) return "stadium";
  if (googleTypes.includes("hospital") || googleTypes.includes("health")) return "hospital";
  if (googleTypes.includes("university") || googleTypes.includes("school")) return "university";
  if (googleTypes.includes("shopping_mall")) return "mall";
  if (googleTypes.includes("casino")) return "casino";
  if (googleTypes.includes("cruise_terminal")) return "cruise_ship";
  if (googleTypes.includes("lodging")) return "resort";
  return "other";
}

function getGenericZones(venueType: VenueType): DiscoveredZone[] {
  switch (venueType) {
    case "airport":
      return [
        { id: "terminal-a", name: "Terminal A", type: "terminal" },
        { id: "terminal-b", name: "Terminal B", type: "terminal" },
        { id: "terminal-c", name: "Terminal C", type: "terminal" },
        { id: "terminal-d", name: "Terminal D", type: "terminal" },
        { id: "terminal-e", name: "Terminal E", type: "terminal" },
        { id: "terminal-intl", name: "International Terminal", type: "terminal" },
        { id: "terminal-main", name: "Main Terminal", type: "terminal" },
      ];
    case "stadium":
      return [
        { id: "lower-level", name: "Lower Level", type: "concourse" },
        { id: "main-concourse", name: "Main Concourse", type: "concourse" },
        { id: "upper-level", name: "Upper Level", type: "concourse" },
        { id: "club-level", name: "Club Level", type: "concourse" },
        { id: "field-level", name: "Field Level", type: "concourse" },
      ];
    default:
      return [];
  }
}

export async function discoverVenue(query: string, requestId?: string): Promise<VenueDiscoveryResult> {
  const reliable = process.env.NODE_ENV === "development";
  const identityQuery = reliable ? venueSearchIdentity(query) : query;
  const normalized = identityQuery.toLowerCase().trim();
  const cacheKey = reliable ? `development-reliable:${normalized}` : normalized;
  const correlation = /^[a-f0-9-]{36}$/i.test(requestId ?? "") ? ` request_id=${requestId}` : "";
  const diagnostic = (reason: string, status?: unknown) => {
    if (!reliable) return;
    const safeStatus = typeof status === "string" &&
      ["OK", "ZERO_RESULTS", "REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST", "UNKNOWN_ERROR", "NOT_FOUND"].includes(status)
      ? status : status == null ? undefined : "UNRECOGNIZED";
    console.info(`[VenueDiscovery] outcome=${reason}${safeStatus ? ` provider_status=${safeStatus}` : ""}${correlation}`);
  };
  const unresolved = (reason = "identity_unresolved"): VenueDiscoveryResult => {
    diagnostic(reason);
    return {
    source: "none", found: false, name: query, type: "other", zones: [], confidence: "low",
    ...(reliable ? { uncertainty: reason === "provider_unavailable" || reason === "provider_not_configured"
      ? "Venue search is temporarily unavailable. Please try again later, or ask the coach for general guidance."
      : "We couldn't confidently identify this venue. Add its city, country, or full name and search again." } : {}),
    };
  };
  if (!normalized) {
    return { source: "none", found: false, name: query, type: "other", zones: [], confidence: "low" };
  }

  if (reliable && !hasNamedVenueIdentity(identityQuery)) return unresolved("named_identity_missing");
  const catalogResult = reliable ? findVenueByIdentity(query) : findVenueByText(query);
  if (catalogResult) {
    diagnostic("catalog_match");
    const { venue } = catalogResult;
    return {
      source: "catalog",
      found: true,
      venueId: venue.id,
      name: venue.name,
      type: venue.type,
      coordinates: venue.coordinates,
      zones: venue.zones
        .filter(z => z.active)
        .map(z => ({ id: z.id, name: z.name, type: z.type })),
      confidence: "high",
    };
  }

  const cached = discoveryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < (reliable && !cached.result.found ? 60_000 : CACHE_TTL)) {
    diagnostic(cached.result.found ? "cached_match" : "cached_no_results");
    return cached.result;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return unresolved("provider_not_configured");
  }

  try {
    const searchResp = await axios.get(TEXT_SEARCH_URL, {
      params: { query: identityQuery, key: GOOGLE_PLACES_API_KEY },
      timeout: 6000,
    });

    if (searchResp.data.status !== "OK" || !searchResp.data.results?.length) {
      diagnostic("text_search_rejected", searchResp.data.status);
      const noResults = searchResp.data.status === "ZERO_RESULTS" || searchResp.data.status === "OK";
      const notFound = unresolved(noResults ? "no_results" : "provider_unavailable");
      // Permission/configuration errors are not 24-hour "no such venue" facts.
      if (!reliable || noResults) discoveryCache.set(cacheKey, { result: notFound, ts: Date.now() });
      return notFound;
    }

    let place = searchResp.data.results[0];
    if (reliable) {
      const requested = venueLookupTokens(identityQuery);
      const candidates = searchResp.data.results.filter((candidate: any) => {
        if (!candidate.place_id || !candidate.name) return false;
        if (requested.includes("airport") && !candidate.types?.includes("airport")) return false;
        return true;
      });
      const matches = candidates.filter((candidate: any) => {
        const identity = new Set(venueLookupTokens(`${candidate.name} ${candidate.formatted_address || ""}`));
        return requested.every(token => identity.has(token));
      });
      const unique = [...new Map<string, any>(matches.map((candidate: any) => [candidate.place_id, candidate])).values()];
      if (unique.length > 1) return unresolved("ambiguous_identity");
      if (unique.length === 1) {
        place = unique[0];
      } else {
        // Search addresses can omit the wider city (e.g. list Hounslow rather
        // than London). Only one fully matching named candidate may proceed to
        // the existing details call; its address components must prove the
        // remaining qualifiers. Never ignore a conflicting city or country.
        const named = candidates.filter((candidate: any) => hasNamedVenueIdentity(candidate.name) &&
          venueLookupTokens(candidate.name).every(token => requested.includes(token)));
        const uniqueNamed = [...new Map<string, any>(named.map((candidate: any) => [candidate.place_id, candidate])).values()];
        if (uniqueNamed.length !== 1) return unresolved(uniqueNamed.length ? "ambiguous_identity" : "identity_mismatch");
        place = uniqueNamed[0];
      }
    }
    const placeId: string = place.place_id;
    const placeName: string = place.name;
    const placeAddress: string = place.formatted_address || "";
    const coordinates = place.geometry?.location
      ? { lat: place.geometry.location.lat as number, lng: place.geometry.location.lng as number }
      : undefined;

    const detailsResp = await axios.get(DETAILS_URL, {
      params: { place_id: placeId, key: GOOGLE_PLACES_API_KEY,
        fields: reliable ? "types,name,address_components" : "types,name" },
      timeout: 5000,
    });

    if (reliable) {
      if (detailsResp.data.status !== "OK") {
        diagnostic("details_rejected", detailsResp.data.status);
        return unresolved("provider_unavailable");
      }
      const components = (detailsResp.data.result?.address_components || [])
        .flatMap((component: any) => [component.long_name, component.short_name]).filter(Boolean).join(" ");
      const evidence = new Set(venueLookupTokens(`${placeName} ${placeAddress} ${components}`));
      if (!venueLookupTokens(identityQuery).every(token => evidence.has(token))) return unresolved("identity_mismatch");
    }

    const googleTypes: string[] = detailsResp.data.result?.types || place.types || [];
    const venueType = reliable && googleTypes.includes("cruise_terminal")
      ? "other" : classifyVenueType(googleTypes);
    // Places establishes a place, not its terminals, decks, or menu inventory.
    const genericZones = reliable ? [] : getGenericZones(venueType);

    const result: VenueDiscoveryResult = {
      source: "google",
      found: true,
      placeId,
      name: placeName,
      type: venueType,
      address: placeAddress,
      coordinates,
      zones: genericZones,
      confidence: "medium",
    };

    discoveryCache.set(cacheKey, { result, ts: Date.now() });
    if (reliable) diagnostic("google_match");
    else console.log(`[VenueDiscovery] Discovered: "${placeName}" type=${venueType} zones=${genericZones.length}`);
    return result;

  } catch (err) {
    if (!reliable) console.warn("[VenueDiscovery] Google Places error:", err instanceof Error ? err.message : err);
    // Axios exception messages/configs may contain the key or member query.
    return unresolved("provider_unavailable");
  }
}

export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}
