# Getaway venue identity repair — Development only

## Corrected failure paths

The reliable lookup previously compared every non-filler query word with the
provider's name and formatted address. Food-help words from a conversational
request became identity constraints, and equivalent country spellings did not
match. Addresses can also name a locality such as Hounslow without the wider
city requested by the member.

Development now:

- Removes bounded first-person conversational wrappers and separate food/help
  clauses before lookup; preserves the venue name, location qualifiers, and
  conflicting venue names.
- Normalizes supported country equivalents (UK/United Kingdom/Great Britain,
  US/USA/United States, UAE/United Arab Emirates), without treating England as
  interchangeable with the entire UK or the pronoun “us” as a country.
- Reuses the existing Places details request, including address components, to
  verify geographic qualifiers missing from the search address.
- Rejects ambiguous candidates, unrelated airports, and unproven/conflicting
  qualifiers rather than trusting the first result.
- Keeps external zones empty: a place match does not establish terminals,
  restaurants, menus, availability, nutrition, or clinical suitability.

## Diagnostics and cache

Static outcomes distinguish no results, ambiguous identity, identity mismatch,
missing named identity, missing provider configuration, provider rejection, and
successful catalog/provider/cache matches. Known provider status values and
UUID-shaped existing request IDs are safe to include. New Development diagnostics
do not log queries, venue names, provider payloads, or exception messages that
could contain credentials.

Provider failures display temporary-unavailability guidance, not instructions
to keep changing a correct place name. Permission/configuration failures are
not cached as nonexistent venues. Genuine zero results expire after one minute;
positive results retain the existing 24-hour cache.

## Verification and release boundary

Tests mock the existing external requests; none contact Google or a model.
They cover the screenshot queries, UK spelling differences, wider-city evidence,
conflicts, ambiguity, country constraints, provider-denial retry, privacy-safe
diagnostics, restaurant integration, and unchanged Production behavior.

No Production matching, generic-zone logic, request fields, or diagnostic behavior
is intentionally changed. There is no new service, dependency, AI stage, or
additional provider-request stage: successful external discovery still uses the
existing text-search and details pair.

Conversation extraction is bounded, not a universal natural-language parser.
Unsupported or unproven descriptions stay unresolved. Live Google availability
and results remain unverified; original logs did not retain enough provider
evidence to establish the exact reason for the original precise-query failure.
