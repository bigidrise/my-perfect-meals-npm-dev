# Ask Chef navigation reliability — Development review

## Release boundary

Development implementation only. No Production workspace changes, release,
push, merge or paid model calls are authorized by this implementation approval.
Mocked checks are not evidence of live conversational quality.

## Authority

Reviewed navigation records supply UI entry relationships and handoff text.
The model can explain feature purposes and interpret unresolved needs; it cannot
invent menu paths, destinations, subsection opening or navigation consent.
Whole named navigation requests are bound to the reviewed records after the
existing care check. Educational questions do not establish opening consent.
All actual navigation still requires a click and the existing server access
resolver; destination-owned clinical and subscription guards remain intact.

Shopping List, My Biometrics and Daily Journal have entry-page actions only.
Navigation does not retrieve account data, change a list, save a measurement,
read journal contents, choose a subject or start generation.

## Other seven gaps reviewed

These have verified guidance but remain outside the action allowlist.

| Feature | Existing contract | Action disposition |
| --- | --- | --- |
| My Favorites | `/saved-meals`; `GuardedSavedMeals` uses `PaywallGuard`; saved content remains account-owned | Candidate for an Essential/paid entry action after separate activation review |
| Recipe Maker | Dashboard card opens a capture dialog after the Essential check | No standalone route; requires a reviewed dialog-opening contract, not an invented URL |
| App Library | `/learn`; existing Learn page | Candidate authenticated entry action; not the Tutorial Hub |
| Tutorial Hub | `/tutorials`; individual tutorial availability varies | Candidate authenticated entry action; retain Coming Soon cards |
| Performance Nutrition Hub | `/performance`; `GuardedPerformanceHub` uses `ClinicalGuard` | Candidate Clinical hub action only; no selected sport, builder or setup transfer |
| My Perfect Pets | `/companion`; `GuardedPetsHub` uses Pro access | Candidate Pro hub action only; no selected animal/profile |
| Academy | `/academy`, entered from More; track progression and later professional authorization are separate | Candidate authenticated Academy entry only; no enrollment or ProCare authority inferred |

Evidence: `client/src/components/Router.tsx`,
`client/src/pages/DashboardNew.tsx`, `client/src/pages/More.tsx`,
`client/src/pages/LifestyleLandingPage.tsx`,
`client/src/pages/academy/AcademyHome.tsx`.

## Deliberately separate

The Create a Dish Lifestyle-card versus Chef-entry access inconsistency and the
Getaway Pro-card versus Clinical-route inconsistency are not changed here.
Feature Intelligence remains offline; this work does not activate its registry
in Ask Chef or replace clinical, nutrition or entitlement authorities.

## Remaining acceptance gate

Founder-approved live conversation checks are required before a Production
release. Include direct requests, educational questions, ambiguous food needs,
restricted accounts, unavailable features and the reported Fridge Rescue case.
