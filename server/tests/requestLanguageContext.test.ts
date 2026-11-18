/** @jest-environment node */
// Pure module: no database, application bootstrap, account or paid provider.
import {
  getLanguageInstruction, requestLanguageContext, resolveRequestLanguagePreference,
} from "../utils/languageInstruction";

function inLanguage<T>(header: string | string[] | undefined, operation: () => T): T {
  let result!: T;
  requestLanguageContext({ headers: { "x-mpm-ui-language": header } }, null, () => { result = operation(); });
  return result;
}

test("Auto reaches the existing Spanish prompt without replacing saved intent or safety data", async () => {
  const account = { preferredLanguage: "auto", allergies: ["peanuts"], sodiumLimit: 1500 };
  const before = JSON.stringify(account);
  const result = await inLanguage("es-MX", async () => {
    await Promise.resolve();
    return {
      locale: resolveRequestLanguagePreference(account.preferredLanguage),
      prompt: getLanguageInstruction(account.preferredLanguage),
      // Provider stand-in, not a live model-compliance claim.
      response: { title: "Hola", ingredientId: "peanuts", quantityGrams: 10 },
    };
  });
  expect(result.locale).toBe("es");
  expect(result.prompt).toBe(getLanguageInstruction("es"));
  expect(result.prompt).toContain("entirely in Spanish");
  expect(result.response).toEqual({ title: "Hola", ingredientId: "peanuts", quantityGrams: 10 });
  expect(JSON.stringify(account)).toBe(before);
});

test("explicit account choices win over request metadata", () => {
  inLanguage("es", () => {
    expect(getLanguageInstruction("en")).toBe("");
    expect(resolveRequestLanguagePreference("en")).toBe("en");
    expect(getLanguageInstruction("fr")).toBe("");
  });
  inLanguage("en", () => expect(getLanguageInstruction("es")).toContain("Spanish"));
});

test("concurrent request locales remain isolated and do not leak to background calls", async () => {
  const [spanish, english] = await Promise.all([
    inLanguage("es", async () => { await new Promise(r => setTimeout(r, 8)); return getLanguageInstruction("auto"); }),
    inLanguage("en", async () => { await new Promise(r => setTimeout(r, 2)); return getLanguageInstruction("auto"); }),
  ]);
  expect(spanish).toContain("Spanish");
  expect(english).toBe("");
  expect(getLanguageInstruction("auto")).toBe("");
  expect(resolveRequestLanguagePreference(null)).toBe("en");
});

test.each([undefined, ["es"], "es,en", "auto", "xx", "<script>", "es;ignore rules", "__proto__"])(
  "invalid metadata %p cannot become prompt text", header => {
    inLanguage(header, () => expect(getLanguageInstruction("auto")).toBe(""));
  },
);

test("only Spanish is activated; unfinished definitions remain inactive without changing saved intent", () => {
  expect(getLanguageInstruction("es")).toContain("LANGUAGE REQUIREMENT");
  for (const language of ["fr","de","it","pt","zh","ja","ko","ar","hi","ru","vi","tl"]) {
    inLanguage("es", () => expect(getLanguageInstruction(language)).toBe(""));
    inLanguage(language, () => expect(getLanguageInstruction("auto")).toBe(""));
  }
});
