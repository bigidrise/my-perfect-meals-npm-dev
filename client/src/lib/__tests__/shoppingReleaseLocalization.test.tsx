/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductCatalogChoices from "@/components/shopping/ProductCatalogChoices";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

let mockLanguage = "en";
jest.mock("react-i18next", () => {
  const instance = jest.requireActual("i18next").createInstance();
  const { consumerEnglish, consumerSpanish } = jest.requireActual("@/i18n/consumerJourney");
  instance.init({
    initImmediate: false, fallbackLng: "en", interpolation: { escapeValue: false },
    resources: { en: { consumerJourney: consumerEnglish }, es: { consumerJourney: consumerSpanish } },
  });
  return { useTranslation: (namespace = "translation") => ({
    t: instance.getFixedT(mockLanguage, namespace), i18n: instance,
  }) };
});
jest.mock("@/components/biometrics/IngredientAnalysisTranslation", () => ({
  IngredientAnalysisText: ({ text }: { text: string }) => <span>{text}</span>,
}));

const phrases = [
  ["Review product identity and label evidence", "Revisar la identidad del producto y la información de la etiqueta"],
  ["Catalog candidate only — not confirmed as the exact recommended variant.", "Solo es una opción del catálogo; no se ha confirmado que sea la variante exacta recomendada."],
  ["Choose for My List", "Elegir para mi lista"],
  ["Shopping reference — Unverified", "Referencia de compra sin verificar"],
  ["Unresolved review items", "Aspectos pendientes de revisión"],
  ["Cancel shopping reference", "Cancelar referencia de compra"],
  ["Saved with review required", "Guardado con revisión pendiente"],
  ["Why Find a Product suggested it · knowledge-based guidance", "Por qué Buscar un producto lo sugirió · orientación basada en conocimientos"],
];
function CopyProbe() {
  const { t } = useConsumerCopy();
  return <>{phrases.map(([english]) => <p key={english}>{t(english)}</p>)}</>;
}
beforeEach(() => { mockLanguage = "en"; });

test("all eight source-owned connections preserve English and resolve Spanish with the real catalog", () => {
  const view = render(<CopyProbe />);
  for (const [english] of phrases) expect(screen.getByText(english)).toBeInTheDocument();
  mockLanguage = "es";
  view.rerender(<CopyProbe />);
  for (const [english, spanish] of phrases) {
    expect(screen.getByText(spanish)).toBeInTheDocument();
    expect(screen.queryByText(english)).not.toBeInTheDocument();
  }
});

test("Spanish catalog explanation preserves product evidence and the exact selected object", () => {
  mockLanguage = "es";
  const select = jest.fn();
  const product: any = {
    productKey: "offline-product", brand: "Untranslated Brand", name: "Untranslated Product",
    shoppingDisplay: "selectable", shoppingSelection: { eligible: true, selection: {} },
    recommendationExplanation: { whyBetter: ["Original provider reason"], targetCriteria: "Original provider criteria" },
    ingredients: "Original package ingredients",
  };
  render(<ProductCatalogChoices compactShopping products={[product]} onSelect={select} />);
  expect(screen.getByText(phrases[7][1])).toBeInTheDocument();
  expect(screen.getByText("Untranslated Brand Untranslated Product")).toBeInTheDocument();
  expect(screen.getByText("Original provider reason")).toBeInTheDocument();
  expect(screen.getByText("Original provider criteria")).toBeInTheDocument();
  expect(screen.getByText("Original package ingredients")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
  expect(select).toHaveBeenCalledWith(product);
});

test.each([false, true])("Spanish saved-choice label preserves review warnings and clear action; reference=%s", reference => {
  mockLanguage = "es";
  const clear = jest.fn().mockResolvedValue(undefined);
  const item: any = {
    name: "olive oil",
    ingredientMetadata: {
      ingredient: { originalName: "olive oil", requirements: [] },
      selectedProduct: {
        name: "Original Oil", brand: "Original Brand", source: { source: "synthetic catalog" },
        selectionKind: reference ? "unverified_shopping_reference" : undefined,
        assessment: { status: "review_required", unresolvedRequirements: ["Original unresolved evidence"] },
      },
    },
  };
  render(<SmartShoppingProductChoice item={item} enabled hasAccess onChoose={jest.fn()} onUpgrade={jest.fn()} onClear={clear} />);
  expect(screen.getByText(reference ? phrases[3][1] : phrases[6][1])).toBeInTheDocument();
  expect(screen.getByText("Original Brand Original Oil")).toBeInTheDocument();
  if (reference) {
    expect(screen.getByText("Not medical or restricted-diet clearance.")).toBeInTheDocument();
    expect(screen.getByText(/Original unresolved evidence/)).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(clear).toHaveBeenCalledTimes(1);
});
