/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { ClinicalSupportLabel, CLINICAL_SUPPORT_RESOURCE_KEYS } from "@/components/ClinicalSupportLabel";
import fs from "node:fs";
import ts from "typescript";

const expectedSpanish: Record<string, string> = {
  "Active Clinical Supports:": "Apoyos Clínicos Activos:",
  "Hormonal & Metabolic:": "Hormonal y Metabólico:",
  "Active Protocol:": "Protocolo activo:",
  "Anti-Inflammatory": "Antiinflamatorio",
  "Anti-Inflammatory (optional)": "Antiinflamatorio (opcional)",
  "Cardiac Health": "Salud Cardíaca",
  "Kidney Disease": "Enfermedad Renal",
  "Liver Support": "Apoyo Hepático",
  "Liver Disease": "Enfermedad Hepática",
  "Oncology Support": "Apoyo Oncológico",
  "Thyroid Support": "Apoyo Tiroideo",
  "Alpha-gal Syndrome": "Síndrome de alfa-gal",
  "Hashimoto's": "Hashimoto",
  "Hypothyroid": "Hipotiroidismo",
  "Hyperthyroid": "Hipertiroidismo",
  "Menopause": "Menopausia",
  "Perimenopause": "Perimenopausia",
  "Metabolic Recovery": "Recuperación Metabólica",
};

afterEach(cleanup);

test.each(["en", "es"])("%s renders every strip label using the centralized resources", async language => {
  await i18n.changeLanguage(language);
  expect(Object.keys(CLINICAL_SUPPORT_RESOURCE_KEYS).sort()).toEqual(Object.keys(expectedSpanish).sort());
  render(<>{Object.keys(expectedSpanish).map((label, index) =>
    <span key={label} data-testid={`support-${index}`}><ClinicalSupportLabel label={label} /></span>,
  )}</>);
  Object.entries(expectedSpanish).forEach(([source, translated], index) => {
    expect(screen.getByTestId(`support-${index}`).textContent).toBe(language === "es" ? translated : source);
  });
});

test("mounted indicators follow language changes without changing keys, active state or styles", async () => {
  await i18n.changeLanguage("en");
  const active = { key: "cardiac", label: "Cardiac Health", isActive: true, className: "text-red-400 font-semibold" };
  const inactive = { key: "kidney-disease", label: "Kidney Disease", isActive: false, className: "text-white/25" };
  const indicators = [active, inactive];
  const before = JSON.stringify(indicators);
  render(<>{indicators.map(indicator =>
    <span key={indicator.key} data-testid={indicator.key} data-active={indicator.isActive} className={indicator.className}>
      <ClinicalSupportLabel label={indicator.label} />
    </span>,
  )}</>);
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByTestId("cardiac")).toHaveTextContent("Salud Cardíaca");
  expect(screen.getByTestId("cardiac")).toHaveAttribute("data-active", "true");
  expect(screen.getByTestId("cardiac")).toHaveClass("text-red-400", "font-semibold");
  expect(screen.getByTestId("kidney-disease")).toHaveTextContent("Enfermedad Renal");
  expect(screen.getByTestId("kidney-disease")).toHaveAttribute("data-active", "false");
  expect(screen.getByTestId("kidney-disease")).toHaveClass("text-white/25");
  expect(JSON.stringify(indicators)).toBe(before);
});

test("unknown or already-translated clinician labels are not rewritten", async () => {
  await i18n.changeLanguage("es");
  render(<>
    <span><ClinicalSupportLabel label="Custom clinician label" /></span>
    <span><ClinicalSupportLabel label="Apoyo Hepático" /></span>
    <span><ClinicalSupportLabel label="__proto__" /></span>
  </>);
  expect(screen.getByText("Custom clinician label")).toBeInTheDocument();
  expect(screen.getByText("Apoyo Hepático")).toBeInTheDocument();
  expect(screen.getByText("__proto__")).toBeInTheDocument();
});

test.each([
  "pro/GeneralNutritionBuilder",
  "pro/PerformanceCompetitionBuilder",
  "physician/DiabeticMenuBuilder",
  "physician/GLP1MealBuilder",
  "physician/AntiInflammatoryMenuBuilder",
])("%s connects both indicator strips without translating their canonical condition keys", page => {
  const file = `client/src/pages/${page}.tsx`;
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let indicatorLabels = 0;
  const conditionKeys: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "ClinicalSupportLabel") {
      const label = node.attributes.properties.find(property =>
        ts.isJsxAttribute(property) && property.name.getText(source) === "label") as ts.JsxAttribute;
      if (label.initializer && ts.isJsxExpression(label.initializer) &&
        label.initializer.expression?.getText(source) === "label") indicatorLabels++;
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "key" &&
      ts.isStringLiteral(node.initializer)) conditionKeys.push(node.initializer.text);
    if (ts.isJsxText(node)) {
      expect(["Active Clinical Supports:", "Hormonal & Metabolic:", "Active Protocol:"]).not.toContain(node.text.trim());
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(indicatorLabels).toBe(2);
  // Anti-Inflammatory's existing strip omits its primary mode and uses heart-failure
  // as the cardiac key. Localization must preserve that builder-specific contract.
  const primaryKeys = page === "physician/AntiInflammatoryMenuBuilder"
    ? ["heart-failure"] : ["anti-inflammatory", "cardiac"];
  for (const key of [...primaryKeys, "kidney-disease", "liver-support",
    "liver-disease", "oncology-support", "thyroid-support", "alpha-gal-syndrome",
    "hashimotos", "hypothyroid", "hyperthyroid", "menopause", "perimenopause", "metabolic-recovery"]) {
    expect(conditionKeys).toContain(key);
  }
  expect(text).toContain("isClinicalIndicatorActive(");
});
