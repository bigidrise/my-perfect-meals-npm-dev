---
name: Location Context Engine
description: Venue/Zone platform for My Perfect Getaway — architecture, data shape, and security decisions.
---

# Location Context Engine

## Architecture

Engine is a generic platform, not airport-specific. Any large venue is a Venue; any sub-area is a Zone.

| Layer | File | Purpose |
|-------|------|---------|
| Types | `server/services/locationContext/types.ts` | Engine contract — Venue, VenueZone, LocationContext interfaces |
| Data | `server/data/venueCatalog.ts` | Typed catalog (starts as TS file; swap to DB for Phase 3+) |
| Engine | `server/services/locationContext/engine.ts` | findVenueByText, assembleLocationContext, buildVenueAwareSearchQuery, buildVenueContextBlock |
| Route | `server/routes/getaway.ts` | GET /venues returns public catalog; POST /coach accepts venueId + zoneId |
| Frontend | `client/src/pages/lifestyle/MyPerfectGetaway.tsx` | Zone picker panel; ChevronDown on quick venue pills that have zones |

## Data shape

```typescript
Venue { id, name, type, country, state, city, timezone, aliases[], searchKeywords[], active, zones[], coordinates? }
VenueZone { id, name, type, searchKeywords[], notes?, active }
LocationContext { venue, zone, confidence: "high"|"medium"|"low", confidenceReason }
```

**Why:** zones are generic — type is "terminal" | "land" | "deck" | "concourse" | etc. Engine never cares what the zone type is called; it just labels it.

## Venue catalog — Phase 1 contents

12 major US airports (DFW, LAX, ORD, ATL, JFK, MCO, LAS, SFO, SEA, BOS, IAH, PHX, MIA + MIA), 4 Disney World parks, Disneyland CA, Universal Studios FL, Islands of Adventure FL, Universal Hollywood, Royal Caribbean cruise, Carnival cruise, Disney Cruise Line.

## IDOR security fix

getaway.ts and restaurants.ts previously trusted `userId` from req.body/req.query. Both were already behind `requireAuth` middleware but didn't use `req.authUser.id`. Fixed in this implementation — all four endpoints in restaurants.ts and the getaway /coach endpoint now derive userId exclusively from `(req as AuthenticatedRequest).authUser.id`.

**Why:** Health context (medical conditions, nutrition protocols, biometrics) deepens as the engine grows. Trust boundary must be established before the feature expands.

## Zone picker UX

VENUE_ALIAS_MAP in the frontend maps quick-start venue labels → catalog IDs. When a venue has zones, the quick-start pill shows a ChevronDown. Tap shows the zone picker (slide-in panel) with all zone pills + "Not sure — skip" option. Selected zone is appended to the message and passed as `zoneId` in the POST body.

## Search query upgrade (Phase 2)

`buildVenueAwareSearchQuery(context)` returns:
- With zone: `"restaurants in Dallas/Fort Worth International Airport Terminal Terminal D"`
- Without zone: `"restaurants at Dallas/Fort Worth International Airport"`

Restaurant resolver already has `overrideQuery` support — pass this string to bypass ZIP-based search.

## Phase roadmap

- Phase 1+2: shipped together (catalog + zone picker + enriched coach prompt)
- Phase 3: DB-backed venues + GPS geofence auto-detection
- Phase 4: Location Context feeds into User Brain reasoning alongside medical/nutrition context
