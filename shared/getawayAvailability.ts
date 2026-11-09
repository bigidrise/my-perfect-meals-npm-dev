export interface GetawayAvailability {
  status: "listings_found" | "no_matches_found" | "unavailable" | "location_required";
  summary: string;
  preferences: { cuisine: string | null; diets: string[] };
  restaurants: Array<{
    name: string;
    address: string;
    menuStatus: "published" | "unverified";
    menuNote: string;
  }>;
}
