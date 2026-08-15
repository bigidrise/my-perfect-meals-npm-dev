/**
 * Pairing Image Service — unit tests
 *
 * Pure-function tests: no DB, no network.
 * Run: npx tsx server/services/__tests__/pairingsImageService.test.ts
 *
 * Covers:
 *  1. generatePairingImage — calls the image generator with sourceType "beverage"
 *  2. generatePairingImage — mealName is "<drinkName> paired with <foodContext>"
 *  3. generatePairingImage — ingredients list passed is always empty (no-recipe exception)
 *  4. generatePairingImage — returns the URL returned by the generator
 *  5. generatePairingImage — returns null when generator returns null
 *  6. generatePairingImage — returns null (no throw) when generator throws
 *  7. generatePairingImages — result Map is keyed as "category:name"
 *  8. generatePairingImages — Map value is the URL from the generator
 *  9. generatePairingImages — null URL is stored in the Map as null
 * 10. generatePairingImages — rejected promises are omitted from the Map
 * 11. generatePairingImages — multiple pairings produce all expected keys
 */

import { generatePairingImage, generatePairingImages, type ImageGenerator } from "../pairings/pairingsImageService";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failMessages.push(label);
    console.log(`  ❌ ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub factory
// ─────────────────────────────────────────────────────────────────────────────

type CallRecord = { mealName: string; ingredients: string[]; sourceType: string };

function makeStub(returnValue: string | null): { stub: ImageGenerator; calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const stub: ImageGenerator = async (mealName, ingredients, sourceType) => {
    calls.push({ mealName, ingredients, sourceType });
    return returnValue;
  };
  return { stub, calls };
}

function makeThrowingStub(error: Error): { stub: ImageGenerator; calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const stub: ImageGenerator = async (mealName, ingredients, sourceType) => {
    calls.push({ mealName, ingredients, sourceType });
    throw error;
  };
  return { stub, calls };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: generatePairingImage
// ─────────────────────────────────────────────────────────────────────────────

console.log("\ngeneratePairingImage");

// Test 1 — sourceType passed to the image generator is "beverage"
{
  const { stub, calls } = makeStub("https://example.com/wine.jpg");
  await generatePairingImage("grilled salmon", "Chardonnay", "wine", stub);
  assert(calls[0]?.sourceType === "beverage", "sourceType passed to image generator is 'beverage'");
}

// Test 2 — mealName is "<drinkName> paired with <foodContext>"
{
  const { stub, calls } = makeStub("https://example.com/wine.jpg");
  await generatePairingImage("grilled salmon", "Chardonnay", "wine", stub);
  assert(
    calls[0]?.mealName === "Chardonnay paired with grilled salmon",
    "mealName is '<drinkName> paired with <foodContext>'"
  );
}

// Test 3 — ingredients list passed is always empty (no-recipe exception)
{
  const { stub, calls } = makeStub("https://example.com/wine.jpg");
  await generatePairingImage("steak", "Cabernet Sauvignon", "red wine", stub);
  assert(
    Array.isArray(calls[0]?.ingredients) && calls[0]?.ingredients.length === 0,
    "ingredients list passed is empty (no-recipe exception)"
  );
}

// Test 4 — returns the URL returned by the generator
{
  const fakeUrl = "https://example.com/ipa.jpg";
  const { stub } = makeStub(fakeUrl);
  const result = await generatePairingImage("burger", "IPA", "beer", stub);
  assert(result === fakeUrl, "returns the URL returned by the image generator");
}

// Test 5 — returns null when generator returns null
{
  const { stub } = makeStub(null);
  const result = await generatePairingImage("pasta", "Pinot Grigio", "wine", stub);
  assert(result === null, "returns null when image generator returns null");
}

// Test 6 — returns null (no throw) when generator throws
{
  const { stub } = makeThrowingStub(new Error("network timeout"));
  const result = await generatePairingImage("chicken", "Riesling", "wine", stub);
  assert(result === null, "returns null (does not throw) when image generator throws");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: generatePairingImages
// ─────────────────────────────────────────────────────────────────────────────

console.log("\ngeneratePairingImages");

// Test 7 — result Map is keyed as "category:name"
{
  const { stub } = makeStub("https://example.com/img.jpg");
  const pairings = [
    { name: "Chardonnay", category: "white wine" },
    { name: "IPA", category: "beer" },
  ];
  const result = await generatePairingImages(pairings, "grilled salmon", stub);
  assert(result.has("white wine:Chardonnay"), "Map has key 'white wine:Chardonnay'");
  assert(result.has("beer:IPA"), "Map has key 'beer:IPA'");
}

// Test 8 — Map value is the URL from the generator
{
  const fakeUrl = "https://example.com/chardonnay.jpg";
  const { stub } = makeStub(fakeUrl);
  const pairings = [{ name: "Chardonnay", category: "white wine" }];
  const result = await generatePairingImages(pairings, "grilled salmon", stub);
  assert(result.get("white wine:Chardonnay") === fakeUrl, "Map value is the URL from the image generator");
}

// Test 9 — null URL is stored in the Map as null
{
  const { stub } = makeStub(null);
  const pairings = [{ name: "Riesling", category: "white wine" }];
  const result = await generatePairingImages(pairings, "sushi", stub);
  assert(result.has("white wine:Riesling"), "Map contains key even when URL is null");
  assert(result.get("white wine:Riesling") === null, "Map value is null when generator returns null");
}

// Test 10 — when the generator throws, the key is still in the Map as null
//
// generatePairingImage has its own try/catch so it always resolves (never rejects).
// Promise.allSettled therefore sees a fulfilled { key, url: null }, and
// generatePairingImages stores the key with a null value rather than omitting it.
// This confirms the batch never crashes and all keys are accounted for.
{
  let callCount = 0;
  const throwingOnSecondCall: ImageGenerator = async (mealName, ingredients, sourceType) => {
    callCount++;
    if (callCount === 2) throw new Error("image generation failed");
    return "https://example.com/ok.jpg";
  };

  const pairings = [
    { name: "Chardonnay", category: "white wine" },
    { name: "Pinot Noir", category: "red wine" }, // throws on second call
  ];
  const result = await generatePairingImages(pairings, "salmon", throwingOnSecondCall);
  assert(result.has("white wine:Chardonnay"), "fulfilled pairing is present in Map");
  assert(result.get("white wine:Chardonnay") === "https://example.com/ok.jpg", "fulfilled pairing has correct URL");
  assert(result.has("red wine:Pinot Noir"), "failed pairing key is still present in Map (not dropped)");
  assert(result.get("red wine:Pinot Noir") === null, "failed pairing value is null (error handled, batch did not crash)");
}

// Test 11 — multiple pairings all produce expected keys
{
  const { stub } = makeStub("https://example.com/drink.jpg");
  const pairings = [
    { name: "Sparkling Water", category: "non-alcoholic" },
    { name: "Merlot", category: "red wine" },
    { name: "Kombucha", category: "fermented" },
  ];
  const result = await generatePairingImages(pairings, "cheese board", stub);
  assert(result.size === 3, "Map contains all 3 pairing keys");
  assert(result.has("non-alcoholic:Sparkling Water"), "key 'non-alcoholic:Sparkling Water' present");
  assert(result.has("red wine:Merlot"), "key 'red wine:Merlot' present");
  assert(result.has("fermented:Kombucha"), "key 'fermented:Kombucha' present");
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failMessages.length > 0) {
  console.log("\nFailed tests:");
  failMessages.forEach(m => console.log(`  - ${m}`));
  process.exit(1);
} else {
  process.exit(0);
}
