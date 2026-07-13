export type VenueType =
  | "airport"
  | "theme_park"
  | "cruise_ship"
  | "stadium"
  | "hospital"
  | "university"
  | "convention_center"
  | "mall"
  | "resort"
  | "casino"
  | "other";

export type LocationConfidence = "high" | "medium" | "low";

export interface VenueZone {
  id: string;
  name: string;
  type: string;
  searchKeywords: string[];
  notes?: string;
  active: boolean;
}

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  country: string;
  state: string;
  city: string;
  timezone: string;
  aliases: string[];
  searchKeywords: string[];
  active: boolean;
  zones: VenueZone[];
  coordinates?: { lat: number; lng: number };
}

export interface LocationContext {
  venue: Venue;
  zone: VenueZone | null;
  confidence: LocationConfidence;
  confidenceReason: string;
}

export interface VenueSearchResult {
  venue: Venue;
  matchedAlias?: string;
}
