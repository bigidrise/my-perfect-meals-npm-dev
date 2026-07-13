import axios from "axios";
import { findVenueByText } from "./engine";
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

export async function discoverVenue(query: string): Promise<VenueDiscoveryResult> {
  const normalized = query.toLowerCase().trim();
  if (!normalized) {
    return { source: "none", found: false, name: query, type: "other", zones: [], confidence: "low" };
  }

  const catalogResult = findVenueByText(query);
  if (catalogResult) {
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

  const cached = discoveryCache.get(normalized);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.result;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return { source: "none", found: false, name: query, type: "other", zones: [], confidence: "low" };
  }

  try {
    const searchResp = await axios.get(TEXT_SEARCH_URL, {
      params: { query, key: GOOGLE_PLACES_API_KEY },
      timeout: 6000,
    });

    if (searchResp.data.status !== "OK" || !searchResp.data.results?.length) {
      const notFound: VenueDiscoveryResult = {
        source: "none", found: false, name: query, type: "other", zones: [], confidence: "low",
      };
      discoveryCache.set(normalized, { result: notFound, ts: Date.now() });
      return notFound;
    }

    const place = searchResp.data.results[0];
    const placeId: string = place.place_id;
    const placeName: string = place.name;
    const placeAddress: string = place.formatted_address || "";
    const coordinates = place.geometry?.location
      ? { lat: place.geometry.location.lat as number, lng: place.geometry.location.lng as number }
      : undefined;

    const detailsResp = await axios.get(DETAILS_URL, {
      params: { place_id: placeId, key: GOOGLE_PLACES_API_KEY, fields: "types,name" },
      timeout: 5000,
    });

    const googleTypes: string[] = detailsResp.data.result?.types || place.types || [];
    const venueType = classifyVenueType(googleTypes);
    const genericZones = getGenericZones(venueType);

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

    discoveryCache.set(normalized, { result, ts: Date.now() });
    console.log(`[VenueDiscovery] Discovered: "${placeName}" type=${venueType} zones=${genericZones.length}`);
    return result;

  } catch (err) {
    console.warn("[VenueDiscovery] Google Places error:", err instanceof Error ? err.message : err);
    return { source: "none", found: false, name: query, type: "other", zones: [], confidence: "low" };
  }
}

export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}
