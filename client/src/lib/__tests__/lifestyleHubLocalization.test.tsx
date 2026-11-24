/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import i18n from "@/i18n";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { readFileSync } from "node:fs";

const hubs = [
  "BeverageCreatorHub.tsx",
  "CravingCreatorLanding.tsx",
  "SocializingHub.tsx",
  "lifestyle/PairingsHub.tsx",
];

const hubSources = hubs.map(file => ({
  file,
  source: readFileSync(`client/src/pages/${file}`, "utf8"),
}));

const phrases = [...new Set(hubSources.flatMap(({ source }) => [
  ...Array.from(source.matchAll(/\bt\("([^"]+)"\)/g), m => m[1]),
  ...Array.from(source.matchAll(/\b(?:title|description):\s*"([^"]+)"/g), m => m[1]),
]))];

afterEach(cleanup);

test("every hub phrase has registered English and Spanish resources", () => {
  expect(phrases.length).toBeGreaterThan(30);

  for (const phrase of phrases) {
    const options = { keySeparator: false } as const;

    expect({
      phrase,
      value: i18n.getResource("en", "consumerJourney", phrase, options),
    }).toEqual({ phrase, value: phrase });

    expect({
      phrase,
      translated: Boolean(
        i18n.getResource("es", "consumerJourney", phrase, options)?.trim()
      ),
    }).toEqual({ phrase, translated: true });
  }
});

test("all hub phrases follow live language switching", async () => {
  await i18n.changeLanguage("en");
  const { result } = renderHook(() => useConsumerCopy());

  for (const phrase of phrases) {
    expect(result.current.t(phrase)).toBe(phrase);
  }

  await act(async () => {
    await i18n.changeLanguage("es");
  });

  for (const phrase of phrases) {
    expect(result.current.t(phrase)).toBe(
      i18n.getResource("es", "consumerJourney", phrase, {
        keySeparator: false,
      })
    );
  }

  await act(async () => {
    await i18n.changeLanguage("en");
  });

  for (const phrase of phrases) {
    expect(result.current.t(phrase)).toBe(phrase);
  }
});

test.each(hubSources)("$file connects card content to localization", ({ source }) => {
  expect(source).toMatch(/\{t\((?:card|feature)\.title\)\}/);
  expect(source).toMatch(/\{t\((?:card|feature)\.description\)\}/);
  expect(source).toContain("document.title = t(");
});

test.each(["en", "es"])("%s main Lifestyle hub resources resolve", async language => {
  await i18n.changeLanguage(language);
  const { result } = renderHook(() => useConsumerCopy("lifestyle"));

  const keys = [
    "title", "createDishTitle", "createDishDesc",
    "cravingsTitle", "cravingsDesc",
    "beverageTitle", "beverageDesc",
    "pairingsTitle", "pairingsDesc",
    "fridgeRescueTitle", "fridgeRescueDesc",
    "awayFromHomeTitle", "awayFromHomeDesc",
    "petsTitle", "petsDesc",
    "pregnancyTitle", "pregnancyDesc",
    "getawayTitle", "getawayDesc",
    "gatheringsTitle", "gatheringsDesc",
    "myStudio", "creatorStudioLabel", "creatorStudioSubtitle",
  ];

  for (const key of keys) {
    const expected = i18n.getResource(language, "lifestyle", key);
    expect({ key, registered: Boolean(expected) })
      .toEqual({ key, registered: true });
    expect(result.current.t(key)).toBe(expected);
  }

  for (const phrase of [
    "Lifestyle | My Perfect Meals",
    "Coming Soon (Clinical)",
    "Existing settings are preserved. Daily calorie and macro targets are not pregnancy-adjusted.",
  ]) {
    const expected = i18n.getResource(language, "consumerJourney", phrase, {
      keySeparator: false,
    });
    expect(expected).toBeTruthy();
    expect(result.current.t(phrase)).toBe(expected);
  }
});
