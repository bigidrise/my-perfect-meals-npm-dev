/** @jest-environment jsdom */
import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import {
  ACTIVE_NUTRITION_PRIORITY_DEFINITIONS,
  NutritionPrioritiesSelector,
} from "@/components/NutritionPrioritiesSelector";

const phrases = [...new Set(
  ACTIVE_NUTRITION_PRIORITY_DEFINITIONS.flatMap(d => [
    d.label,
    d.shortSummary,
    d.whatItIs,
    d.whyChooseIt,
    d.whatMpmDoes,
    ...d.foodExamples,
    ...d.limitations,
    ...d.citations.map(c => c.title),
    d.pediatricProjection.shortSummary,
    d.pediatricProjection.whyChooseIt,
    d.pediatricProjection.whatMpmDoes,
    ...d.pediatricProjection.limitations,
  ])
)];

afterEach(async () => {
  await i18n.changeLanguage("en");
});

test("all active registry display phrases have registered EN and ES resources", () => {
  expect(phrases).toHaveLength(149);

  for (const phrase of phrases) {
    expect(i18n.getResource("en", "consumerJourney", phrase, {
      keySeparator: false,
    })).toBe(phrase);

    expect({
      phrase,
      registered: Boolean(
        i18n.getResource("es", "consumerJourney", phrase, {
          keySeparator: false,
        })?.trim()
      ),
    }).toEqual({ phrase, registered: true });
  }
});

test.each(["adult", "pediatric"] as const)(
  "%s summaries follow live language changes without changing selection IDs",
  async audience => {
    await i18n.changeLanguage("en");
    const onChange = jest.fn();

    function Fixture() {
      const { t } = useConsumerCopy();
      return <>
        <NutritionPrioritiesSelector
          selectedPriorityIds={[]}
          onChange={onChange}
          audience={audience}
        />
        <span data-testid="language-probe">{t("Fiber-Rich Foods")}</span>
      </>;
    }

    render(<Fixture />);

    for (const d of ACTIVE_NUTRITION_PRIORITY_DEFINITIONS) {
      const summary = audience === "adult"
        ? d.shortSummary
        : d.pediatricProjection.shortSummary;

      expect(screen.getByTestId(`nutrition-priority-${d.id}`))
        .toHaveTextContent(summary);
    }

    await act(async () => {
      await i18n.changeLanguage("es");
    });

    for (const d of ACTIVE_NUTRITION_PRIORITY_DEFINITIONS) {
      const summary = audience === "adult"
        ? d.shortSummary
        : d.pediatricProjection.shortSummary;

      const translated = i18n.getResource(
        "es", "consumerJourney", summary,
        { keySeparator: false }
      );

      expect(translated).toBeTruthy();
      expect(translated).not.toBe(summary);
      expect(screen.getByTestId(`nutrition-priority-${d.id}`))
        .toHaveTextContent(translated);
    }

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("nutrition-priority-fiber_rich_foods"));
    expect(onChange).toHaveBeenCalledWith(["fiber_rich_foods"]);
  }
);
