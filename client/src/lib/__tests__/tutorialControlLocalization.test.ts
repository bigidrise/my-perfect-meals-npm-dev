/** @jest-environment jsdom */
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import fs from "node:fs";
import path from "node:path";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import { TUTORIAL_VIDEO_REGISTRY, type TutorialFeature } from "@/lib/tutorialVideoRegistry";

const localeDir = path.resolve(__dirname, "../../i18n/locales");
const locales = fs.readdirSync(localeDir).filter(f => f.endsWith(".json") && f !== "xq.json");
afterEach(cleanup);

test.each(locales)("tutorial controls use real %s translations without changing availability", async file => {
  const language = file.replace(".json", "");
  const resource = JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language, fallbackLng: false,
    resources: { [language]: { translation: resource } },
    interpolation: { escapeValue: false },
  });
  const label = resource.tutorialControl.howItWorks;
  const expectedTitle = resource.tutorialControl.watchTutorial.replace("{{label}}", label);
  expect(expectedTitle).not.toContain("{{");
  expect(resource.getawayDining.venuePlaceholder).toBeTruthy();
  if (language !== "en") {
    expect(label).not.toBe("How It Works");
    expect(resource.getawayDining.venuePlaceholder).not.toBe("Enter a restaurant or dining location at this destination");
  }
  let active = 0, pending = 0;
  for (const [feature, url] of Object.entries(TUTORIAL_VIDEO_REGISTRY)) {
    const { container, unmount } = render(React.createElement(I18nextProvider, { i18n },
      React.createElement(HowThisWorksLink, { featureKey: feature as TutorialFeature, labelKey: "tutorialControl.howItWorks" })));
    if (!url) { expect(container.innerHTML).toBe(""); pending++; unmount(); continue; }
    active++;
    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-label")).toBe(expectedTitle);
    expect(button.getAttribute("title")).toBe(expectedTitle);
    expect(button.type).toBe("button");
    expect(container.querySelector("span")?.textContent).toBe(label);
    unmount();
  }
  expect(active).toBe(39);
  expect(pending).toBe(5);
});
