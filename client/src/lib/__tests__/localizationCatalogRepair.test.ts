import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createInstance } from "i18next";

const localeDir = path.resolve("client/src/i18n/locales");
const languages = ["en", "ar", "de", "es", "fr", "hi", "it", "ja", "ko", "pt", "ru", "tl", "vi", "zh"];
const catalogs = Object.fromEntries(languages.map(language => [
  language, JSON.parse(fs.readFileSync(path.join(localeDir, `${language}.json`), "utf8")),
]));

function flatten(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof entry === "string"
      ? [[fullKey, entry]]
      : Object.entries(flatten(entry as Record<string, unknown>, fullKey));
  }));
}

const english = flatten(catalogs.en);
const variables = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();

describe.each(languages)("localization catalog integrity: %s", language => {
  test("has no duplicate JSON properties that can overwrite translations", () => {
    const source = ts.parseJsonText(`${language}.json`, fs.readFileSync(path.join(localeDir, `${language}.json`), "utf8"));
    const duplicates: string[] = [];
    function visit(node: ts.Node, prefix = "") {
      if (ts.isObjectLiteralExpression(node)) {
        const seen = new Set<string>();
        for (const property of node.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = property.name.getText(source);
          const key = prefix ? `${prefix}.${name}` : name;
          if (seen.has(name)) duplicates.push(key);
          seen.add(name);
          visit(property.initializer, key);
        }
      } else {
        ts.forEachChild(node, child => visit(child, prefix));
      }
    }
    visit(source);
    expect(duplicates).toEqual([]);
  });

  test("contains every English key without empty values or lost interpolation tokens", () => {
    const localized = flatten(catalogs[language]);
    for (const [key, source] of Object.entries(english)) {
      expect(localized[key]).toEqual(expect.any(String));
      expect(localized[key].trim()).not.toBe("");
      expect(variables(localized[key])).toEqual(variables(source));
    }
  });

  test("retains both the original meal picker copy and its newer no-options message", () => {
    const picker = catalogs[language].mealPicker;
    expect(picker.addTo).toContain("{{slot}}");
    expect(picker.generateCount).toContain("{{count}}");
    expect(picker.categories.proteins).toEqual(expect.any(String));
    expect(picker.info.title).toEqual(expect.any(String));
    expect(picker.info.addText).toContain("{{slot}}");
    expect(picker.noOptionsFitPlan).toEqual(expect.any(String));
    expect(Object.keys(flatten(picker))).toHaveLength(29);
  });
});

test.each([
  ["ru", [1, 2, 5, 21], ["результат", "результата", "результатов", "результат"]],
  ["ar", [0, 1, 2, 3, 11, 100], ["نتيجة", "نتيجة واحدة", "نتيجتان", "نتائج", "نتيجة", "نتيجة"]],
] as const)("restored result-count translations select the %s plural forms", async (language, counts, expected) => {
  const i18n = createInstance();
  await i18n.init({ lng: language, resources: { [language]: { translation: catalogs[language] } }, fallbackLng: false });
  counts.forEach((count, index) => {
    const rendered = i18n.t("fridgeRescue.resultsCount", { count });
    expect(rendered).toContain(String(count));
    expect(rendered).toContain(expected[index]);
    expect(rendered).not.toContain("{{");
    expect(rendered).not.toContain("fridgeRescue.");
  });
});
